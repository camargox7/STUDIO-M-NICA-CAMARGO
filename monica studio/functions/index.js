const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const moment = require("moment-timezone");

admin.initializeApp();
const db = admin.firestore();

// Configuração do transporter do Nodemailer (Precisa configurar as variáveis de ambiente no Firebase)
// firebase functions:config:set gmail.email="seuemail@gmail.com" gmail.password="suasenha_de_app"
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: functions.config().gmail ? functions.config().gmail.email : 'TEST_EMAIL',
        pass: functions.config().gmail ? functions.config().gmail.password : 'TEST_PASS'
    }
});

/**
 * Função Agendada: Executa todos os dias às 08:00 AM (Horário de Brasília)
 * Objetivo: Enviar lembretes para agendamentos do dia seguinte.
 */
exports.enviarLembretesDiarios = functions.pubsub.schedule('0 8 * * *')
    .timeZone('America/Sao_Paulo')
    .onRun(async (context) => {
        try {
            // Calcula a data de amanhã no formato YYYY-MM-DD
            const amanha = moment().tz('America/Sao_Paulo').add(1, 'days').format('YYYY-MM-DD');
            console.log(`Buscando agendamentos Confirmados para a data: ${amanha}`);

            // Busca os agendamentos Confirmados para amanhã
            const snapshot = await db.collection("agendamentos")
                .where("data", "==", amanha)
                .where("status", "==", "Confirmado")
                .get();

            if (snapshot.empty) {
                console.log('Nenhum agendamento encontrado para lembrete.');
                return null;
            }

            const promessasEmails = [];

            snapshot.forEach(doc => {
                const agendamento = doc.data();
                
                // Ignorar Bloqueios Administrativos
                if (agendamento.clienteNome && agendamento.clienteNome.includes("BLOQUEIO")) {
                    return;
                }

                if (agendamento.clienteEmail) {
                    const mailOptions = {
                        from: `Studio Mônica Camargo <${functions.config().gmail ? functions.config().gmail.email : 'noreply@studiomonica.com'}>`,
                        to: agendamento.clienteEmail,
                        subject: `Lembrete de Agendamento - Studio Mônica Camargo 🌟`,
                        html: `
                            <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #d4af37; border-radius: 10px; overflow: hidden;">
                                <div style="background-color: #111; padding: 20px; text-align: center;">
                                    <h1 style="color: #d4af37; margin: 0; font-family: 'Playfair Display', serif;">Mônica Camargo</h1>
                                    <p style="color: #fff; margin: 5px 0 0 0; font-size: 14px;">Studio de Beleza Premium</p>
                                </div>
                                <div style="padding: 30px; background-color: #fff;">
                                    <h2 style="color: #111; margin-top: 0;">Olá, ${agendamento.clienteNome.split(' ')[0]}!</h2>
                                    <p>Este é um lembrete amigável sobre o seu horário agendado amanhã.</p>
                                    
                                    <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #d4af37; margin: 20px 0;">
                                        <p style="margin: 5px 0;"><strong>Serviço(s):</strong> ${Array.isArray(agendamento.servicos) ? agendamento.servicos.join(", ") : (agendamento.servico || "Serviço")}</p>
                                        <p style="margin: 5px 0;"><strong>Data:</strong> ${amanha.split('-').reverse().join('/')}</p>
                                        <p style="margin: 5px 0;"><strong>Horário:</strong> ${agendamento.hora}</p>
                                    </div>
                                    
                                    <p style="font-size: 13px; color: #666;">Caso precise reagendar ou cancelar, por favor nos contate via WhatsApp com antecedência.</p>
                                    <br>
                                    <p style="margin-bottom: 0;">Aguardamos você!</p>
                                    <p style="margin-top: 5px; font-weight: bold; color: #d4af37;">Equipe Studio Mônica Camargo</p>
                                </div>
                            </div>
                        `
                    };

                    promessasEmails.push(transporter.sendMail(mailOptions));
                    console.log(`Lembrete enfileirado para: ${agendamento.clienteEmail}`);
                }
            });

            await Promise.all(promessasEmails);
            console.log(`Todos os lembretes para ${amanha} foram enviados com sucesso.`);
            return null;

        } catch (error) {
            console.error('Erro ao enviar lembretes diários:', error);
            throw new Error('Falha na Cloud Function de Lembretes');
        }
    });

/**
 * Função de Gatilho (Trigger): Executado imediatamente quando um agendamento for cancelado
 */
exports.notificarCancelamento = functions.firestore
    .document('agendamentos/{agendamentoId}')
    .onUpdate(async (change, context) => {
        const agendamentoAntigo = change.before.data();
        const agendamentoNovo = change.after.data();

        // Verifica se o status mudou PARA 'Cancelado'
        if (agendamentoAntigo.status !== "Cancelado" && agendamentoNovo.status === "Cancelado") {
            if (agendamentoNovo.clienteEmail && !agendamentoNovo.clienteNome.includes("BLOQUEIO")) {
                const dataFormatada = agendamentoNovo.data.split('-').reverse().join('/');
                
                const mailOptions = {
                    from: `Studio Mônica Camargo <${functions.config().gmail ? functions.config().gmail.email : 'noreply@studiomonica.com'}>`,
                    to: agendamentoNovo.clienteEmail,
                    subject: `Cancelamento de Agendamento - Studio Mônica Camargo`,
                    html: `
                        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ff4d4d; border-radius: 10px; overflow: hidden;">
                            <div style="background-color: #fff; padding: 30px;">
                                <h2 style="color: #ff4d4d; margin-top: 0;">Agendamento Cancelado</h2>
                                <p>Olá, ${agendamentoNovo.clienteNome.split(' ')[0]}. Informamos que o seu horário no dia <strong>${dataFormatada}</strong> às <strong>${agendamentoNovo.hora}</strong> foi cancelado.</p>
                                <p style="font-size: 13px; color: #666;">Se isso foi um engano ou se você deseja remarcar, visite nosso aplicativo para agendar um novo horário.</p>
                            </div>
                        </div>
                    `
                };

                try {
                    await transporter.sendMail(mailOptions);
                    console.log(`Aviso de cancelamento enviado para: ${agendamentoNovo.clienteEmail}`);
                } catch (error) {
                    console.error(`Erro ao enviar aviso de cancelamento para ${agendamentoNovo.clienteEmail}:`, error);
                }
            }
        }
        return null;
    });
