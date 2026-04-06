import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
    import { getFirestore, collection, query, getDocs, getDoc, doc, updateDoc, deleteDoc, setDoc, addDoc, orderBy, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

    const firebaseConfig = {
        apiKey: "AIzaSyBJ6CccwzLWQZtkmUdJhoeqouWXU7vv_Sk",
        authDomain: "studio-monica.firebaseapp.com",
        projectId: "studio-monica",
        storageBucket: "studio-monica.firebasestorage.app",
        messagingSenderId: "138869623014",
        appId: "1:138869623014:web:55e0bf1fb8fcf7da431327"
    };

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const horariosBase = ["07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30","12:00","12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00"];
    
    const Toast = Swal.mixin({
        toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true
    });

    window.addEventListener("load", () => {
        criarCaixaBloqueio();
        carregarAgenda();
        carregarClientes();
        carregarServicos();
        carregarServicosNoManual();
        setTimeout(() => document.getElementById("loader").classList.add("loader-hidden"), 1000);
    });

    // CORREÇÃO: Função para carregar a agenda exibindo a DATA
    window.carregarAgenda = async () => {
        const tbody = document.getElementById('lista-agenda');
        const snap = await getDocs(query(collection(db, "agendamentos"), orderBy("data", "asc")));
        tbody.innerHTML = "";
        snap.forEach(docSnap => {
            const d = docSnap.data();
            const isBloqueio = (d.clienteNome || "").includes("BLOQUEIO");
            const status = d.status || 'Pendente';
            const isCancelado = status === "Cancelado";
            const isFinalizado = status === "Finalizado";
            
            // Oculta compromissos finalizados há mais de 2 horas da visualização da agenda viva
            if (isFinalizado) {
                if (d.dataFinalizacao) {
                    const diffAposFinalizacao = (new Date() - new Date(d.dataFinalizacao)) / (1000 * 60 * 60);
                    if (diffAposFinalizacao > 2) return;
                } else {
                    return; // Finalizados antigos sem Timestamp também somem logicamente
                }
            }
            
            const t = parseInt(d.tempoTotal || 60);
            
            // Formata a data de AAAA-MM-DD para DD/MM
            const dataFmt = d.data ? d.data.split('-').reverse().slice(0, 2).join('/') : "--/--";
            
            const duracaoFmt = t >= 720 ? "DIA TODO" : (t >= 60 ? Math.floor(t/60) + "h" + (t%60 > 0 ? (t%60)+"min" : "") : t + "min");
            let cor = isCancelado ? "#ff4d4d" : (status === "Confirmado" ? (isBloqueio ? "#ff4d4d" : "#2ecc71") : (isFinalizado ? "#3498db" : "#f1c40f"));
            
            tbody.innerHTML += `
                <tr class="${isCancelado ? 'linha-cancelada' : (isBloqueio ? 'linha-bloqueio' : '')}">
                    <td><span style="font-size:10px; color:var(--gold)">${dataFmt}</span><br><strong>${d.hora}h</strong></td>
                    <td>${d.clienteNome || d.nome}</td>
                    <td>${Array.isArray(d.servicos) ? d.servicos.join(", ") : (d.servico || "Serviço")}<br><small style="color:var(--gold)">⏱ ${duracaoFmt} ${isFinalizado && d.valorFinal ? `• R$ ${d.valorFinal.toFixed(2)}` : ''}</small></td>
                    <td><span class="status-badge" style="color:${cor}; border-color:${cor}55;">${status.toUpperCase()}</span></td>
                    <td><div style="display:flex; gap:5px;">
                        ${(!isBloqueio && !isCancelado && !isFinalizado) ? `<button class="btn-action btn-check" onclick="confirmarAgendamentoEEnviarZap('${docSnap.id}')" title="Confirmar"><i class="fa-solid fa-check"></i></button>` : ''}
                        ${(!isBloqueio && !isCancelado) ? `<button class="btn-action" style="background:var(--gold-main); color:black; border-color:var(--gold-main);" onclick="finalizarAtendimento('${docSnap.id}', ${d.valorFinal || 0})" title="${isFinalizado ? 'Editar Receita' : 'Finalizar Atendimento'}"><i class="fa-solid ${isFinalizado ? 'fa-pen-to-square' : 'fa-hand-holding-dollar'}"></i></button>` : ''}
                        <button class="btn-action btn-del" onclick="${isCancelado ? `removerItem('${docSnap.id}', 'agendamentos')` : `cancelarAtendimento('${docSnap.id}')`}" title="${isCancelado ? 'Excluir' : 'Cancelar Atendimento'}">${isCancelado ? '<i class="fa-solid fa-trash"></i>' : '<i class="fa-solid fa-times"></i>'}</button>
                    </div></td>
                </tr>`;
        });
    };

    window.finalizarAtendimento = async (id, valorAtual) => {
        const { value: valorFinal } = await Swal.fire({
            title: valorAtual ? 'Editar Receita' : 'Finalizar Atendimento',
            input: 'number',
            inputLabel: 'Qual foi o valor final cobrado? (R$)',
            inputValue: valorAtual || '',
            showCancelButton: true,
            confirmButtonText: 'Salvar',
            cancelButtonText: 'Cancelar',
            inputValidator: (value) => {
                if (!value || value <= 0) return 'Você precisa informar o valor arrecadado!';
            }
        });

        if (valorFinal) {
            await updateDoc(doc(db, "agendamentos", id), {
                status: "Finalizado",
                valorFinal: parseFloat(valorFinal),
                dataFinalizacao: new Date().toISOString()
            });
            Toast.fire({ icon: 'success', title: 'Salvo com sucesso!' });
            carregarAgenda();
        }
    };

    window.salvarCategoria = async (id) => {
        const nomeCat = document.getElementById(`name-${id}`).value;
        const rows = document.getElementById(`container-${id}`).querySelectorAll('.row-item');
        const itens = Array.from(rows).map(r => ({
            nome: r.querySelectorAll('input')[0].value,
            preco: r.querySelectorAll('input')[1].value,
            tempo: r.querySelectorAll('input')[2].value,
            isVariavel: r.querySelector('.var-check') ? r.querySelector('.var-check').checked : false 
        })).filter(i => i.nome !== "");
        await updateDoc(doc(db, "categorias_servicos", id), { nome: nomeCat, itens: itens });
        Toast.fire({ icon: 'success', title: 'Categoria Salva!' });
        carregarServicosNoManual();
    };

    window.atualizarHorariosDisponiveis = async () => {
        const data = document.getElementById('manual-data').value;
        const selectHora = document.getElementById('manual-hora-select');
        const marcados = document.querySelectorAll('input[name="servico-manual"]:checked');
        if(!data) return;
        let tempoNecessario = 0;
        marcados.forEach(m => tempoNecessario += parseInt(m.dataset.tempo));
        if(tempoNecessario === 0) tempoNecessario = 30;
        const q = query(collection(db, "agendamentos"), where("data", "==", data));
        const snap = await getDocs(q);
        let ocupados = [];
        snap.forEach(doc => { 
            const d = doc.data();
            if(d.status !== "Cancelado") { 
                const ini = convMin(d.hora); 
                const fim = d.tempoTotal >= 720 ? 2000 : ini + parseInt(d.tempoTotal || 30);
                ocupados.push({ ini: ini, fim: fim }); 
            } 
        });
        selectHora.innerHTML = '<option value="">Escolha...</option>';
        horariosBase.forEach(h => { 
            const hIni = convMin(h); 
            const hFim = hIni + tempoNecessario;
            const conflito = ocupados.some(o => (hIni < o.fim && hFim > o.ini));
            if(!conflito) selectHora.innerHTML += `<option value="${h}">${h}h</option>`; 
        });
    };

    window.criarCaixaBloqueio = () => {
        const container = document.getElementById('box-bloqueio-container');
        if(!container) return;
        container.innerHTML = `
            <div class="manual-box" style="border-color: var(--red); background: rgba(255, 77, 77, 0.03);">
                <h3 class="section-title" style="margin-top:0; color: var(--red); border-color: var(--red);">Bloquear Agenda</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom:15px;">
                    <div><label class="label-mini">Data</label><input type="date" id="bloqueio-data" class="custom-input" onchange="atualizarHorariosBloqueio()"></div>
                    <div><label class="label-mini">Início</label><select id="bloqueio-hora-ini" class="custom-input"></select></div>
                </div>
                <label class="label-mini">Quanto tempo bloquear?</label>
                <select id="bloqueio-duracao" class="custom-input" style="margin-bottom:15px;">
                    <option value="60">1 hora</option><option value="120">2 horas</option><option value="180">3 horas</option><option value="1440">O DIA TODO (Folga)</option>
                </select>
                <button onclick="salvarBloqueio()" style="width:100%; background:var(--red); color:white; padding:12px; border:none; border-radius:10px; font-weight:bold; cursor:pointer;">EFETUAR BLOQUEIO</button>
            </div>`;
    }

    window.salvarBloqueio = async () => {
        const data = document.getElementById('bloqueio-data').value;
        const hora = document.getElementById('bloqueio-hora-ini').value;
        const duracao = document.getElementById('bloqueio-duracao').value;
        if(!data || !hora) return Toast.fire({ icon: 'error', title: 'Escolha data e hora!' });
        await addDoc(collection(db, "agendamentos"), { clienteNome: "🚫 BLOQUEIO", servicos: ["FOLGA/BLOQUEIO"], data: data, hora: hora, tempoTotal: parseInt(duracao), status: "Confirmado" });
        Swal.fire({ icon: 'success', title: 'Bloqueado!', text: 'Horário indisponível na agenda.', confirmButtonText: 'OK' });
        carregarAgenda();
    };

    window.salvarAgendamentoManual = async () => {
        const nome = document.getElementById('manual-nome').value;
        const marcados = document.querySelectorAll('input[name="servico-manual"]:checked');
        
        if(!nome || !dataSelecionada || !horaSelecionada || marcados.length === 0) {
            return Toast.fire({ icon: 'warning', title: 'Preencha nome do cliente, data, horário e serviços!' });
        }
        
        let s = []; let tempoTotal = 0; 
        marcados.forEach(m => { s.push(m.value); tempoTotal += parseInt(m.dataset.tempo); });

        let slotsNecessarios = Math.ceil(tempoTotal / 30);
        const ocupadosRealTime = await window.obterHorariosOcupados(dataSelecionada);

        for (let i = 0; i < slotsNecessarios; i++) {
            let horaCheck = somarMinutos(horaSelecionada, i * 30);
            if (ocupadosRealTime.includes(horaCheck)) {
                return Swal.fire("Erro de Conflito", "O tempo deste agrupamento de serviços invade outro horário já ocupado na sua agenda!", "error");
            }
        }

        const btn = document.querySelector('button[onclick="salvarAgendamentoManual()"]');
        if(btn) { btn.innerText = "AGENDANDO..."; btn.disabled = true; }

        try {
            await addDoc(collection(db, "agendamentos"), { 
                clienteNome: nome, 
                servicos: s, 
                data: dataSelecionada, 
                hora: horaSelecionada, 
                tempoTotal: tempoTotal, 
                status: "Confirmado" 
            });
            Swal.fire({ icon: 'success', title: 'Agendado!', text: 'O horário foi salvo na agenda.', timer: 2000 });
            carregarAgenda();
            document.getElementById('manual-nome').value = "";
            document.querySelectorAll('.hora-pilula').forEach(el => el.classList.remove('active'));
            horaSelecionada = "";
        } catch(e) {
            Swal.fire("Erro", "Falha ao salvar o agendamento no banco.", "error");
        } finally {
            if(btn) { btn.innerText = "FINALIZAR AGENDAMENTO"; btn.disabled = false; }
        }
    };

    window.confirmarAgendamentoEEnviarZap = async (id) => {
        try {
            const docRef = doc(db, "agendamentos", id);
            const snapshot = await getDoc(docRef);
            if (snapshot.exists()) {
                const dados = snapshot.data();
                const nomeCli = dados.clienteNome || dados.nome;
                let foneRaw = dados.telefone || "";
                if (!foneRaw || foneRaw.length < 8) {
                    const qClientes = query(collection(db, "clientes"), where("nome", "==", nomeCli));
                    const snapClientes = await getDocs(qClientes);
                    snapClientes.forEach(docC => { foneRaw = docC.data().telefone; });
                }
                const foneLimpo = foneRaw ? foneRaw.replace(/\D/g, '') : "";
                if (foneLimpo.length >= 10) {
                    const dataFmt = dados.data ? dados.data.split('-').reverse().join('/') : "--/--/--";
                    const horaCli = dados.hora || "--:--";
                    let servs = Array.isArray(dados.servicos) ? dados.servicos.join(", ") : (dados.servico || "Serviço");
                    const t = parseInt(dados.tempoTotal || 60);
                    const tempoFmt = t >= 60 ? Math.floor(t/60) + "h" + (t%60 > 0 ? (t%60)+"min" : "") : t + "min";
                    const textoMensagem = `CONFIRMAÇÃO DE AGENDAMENTO\n\nOlá, ${nomeCli}! Passando para confirmar seu horário no *Studio Mônica Camargo*. \n\nDATA: ${dataFmt}\nHORÁRIO: ${horaCli}h\nSERVIÇOS: ${servs}\nDURAÇÃO: ~${tempoFmt}\n\nEstamos ansiosas para te ver!`;
                    await updateDoc(docRef, { status: "Confirmado" });
                    window.open(`https://wa.me/55${foneLimpo}?text=${encodeURIComponent(textoMensagem)}`, '_blank');
                    Toast.fire({ icon: 'success', title: 'WhatsApp aberto!' });
                } else {
                    await updateDoc(docRef, { status: "Confirmado" });
                    Toast.fire({ icon: 'warning', title: 'Confirmado (sem telefone)' });
                }
                carregarAgenda();
            }
        } catch (e) { console.error(e); }
    };

    window.cancelarAtendimento = async (id) => {
        Swal.fire({ title: 'Cancelar?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Sim' }).then(async (r) => {
            if (r.isConfirmed) { await updateDoc(doc(db, "agendamentos", id), { status: "Cancelado" }); carregarAgenda(); }
        });
    };

    window.removerItem = async (id, col) => {
        Swal.fire({ title: 'Excluir?', icon: 'error', showCancelButton: true }).then(async (r) => {
            if (r.isConfirmed) { await deleteDoc(doc(db, col, id)); col === 'agendamentos' ? carregarAgenda() : carregarServicos(); }
        });
    };

    window.addLinhaItem = (id) => {
        const div = document.createElement('div'); div.className = 'row-item'; div.style = "display:flex; gap:5px; margin-bottom:5px; align-items:center;";
        div.innerHTML = `<input type="text" placeholder="Serviço" class="custom-input" style="flex:2"><input type="text" placeholder="R$" class="custom-input" style="flex:1"><input type="text" placeholder="Min" class="custom-input" style="flex:1"><div style="display:flex; flex-direction:column; align-items:center; gap:2px;"><label style="font-size:8px; color:var(--gold)">VAR?</label><input type="checkbox" class="var-check"></div><button class="btn-action btn-del" style="width:30px; height:30px;" onclick="this.parentElement.remove()"><i class="fa-solid fa-times"></i></button>`;
        document.getElementById(id).appendChild(div);
    };

    async function carregarServicos() {
        const grid = document.getElementById('grid-servicos');
        const snap = await getDocs(collection(db, "categorias_servicos"));
        const btnAdd = grid.lastElementChild;
        grid.innerHTML = "";
        snap.forEach(documento => {
            const cat = documento.data();
            const card = document.createElement('div'); card.className = 'edit-card';
            card.innerHTML = `<button onclick="removerItem('${documento.id}', 'categorias_servicos')" style="position:absolute; top:20px; right:20px; background:none; border:none; color:var(--red); cursor:pointer; font-size:16px; opacity:0.6; transition:0.3s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'"><i class="fa-solid fa-trash"></i></button><label class="label-mini">Categoria</label><input type="text" id="name-${documento.id}" value="${cat.nome}" class="custom-input" style="margin-bottom:10px; padding-right:40px;"><div id="container-${documento.id}">${(cat.itens || []).map(item => `<div class="row-item" style="display:flex; gap:5px; margin-bottom:5px; align-items:center;"><input type="text" value="${item.nome}" class="custom-input" style="flex:2"><input type="text" value="${item.preco}" class="custom-input" style="flex:1"><input type="text" value="${item.tempo || ''}" class="custom-input" style="flex:1"><div style="display:flex; flex-direction:column; align-items:center; gap:2px;"><label style="font-size:8px; color:var(--gold)">VAR?</label><input type="checkbox" class="var-check" ${item.isVariavel ? 'checked' : ''}></div><button class="btn-action btn-del" style="width:30px; height:30px;" onclick="this.parentElement.remove()"><i class="fa-solid fa-times"></i></button></div>`).join('')}</div><button class="btn-add-sub" onclick="addLinhaItem('container-${documento.id}')"><i class="fa-solid fa-plus" style="margin-right:5px;"></i> Adicionar Item</button><button class="btn-save" onclick="salvarCategoria('${documento.id}')"><i class="fa-solid fa-save" style="margin-right:5px;"></i> SALVAR CATEGORIA</button>`;
            grid.appendChild(card);
        });
        grid.appendChild(btnAdd);
    }

    async function carregarServicosNoManual() {
        const container = document.getElementById('manual-servicos-container');
        const snap = await getDocs(collection(db, "categorias_servicos"));
        container.innerHTML = "";
        snap.forEach(docSnap => { (docSnap.data().itens || []).forEach(item => { container.innerHTML += `<div style="display:flex; align-items:center; gap:8px; margin-bottom:5px; font-size:12px;"><input type="checkbox" name="servico-manual" value="${item.nome}" data-tempo="${item.tempo || 60}" onchange="if(window.gerarHorariosPorPeriodo) window.gerarHorariosPorPeriodo()"> ${item.nome} (${item.tempo || 60} min)</div>`; }); });
    }

    async function carregarClientes() {
        const tbody = document.getElementById('lista-clientes');
        const snap = await getDocs(collection(db, "clientes"));
        tbody.innerHTML = "";
        snap.forEach(docSnap => { const u = docSnap.data(); const tel = u.telefone ? u.telefone.replace(/\D/g, '') : ''; tbody.innerHTML += `<tr><td>${u.nome}</td><td>${u.telefone}</td><td><a href="https://wa.me/55${tel}" target="_blank" style="background:#25d366; color:white; padding:5px 10px; border-radius:5px; text-decoration:none; font-size:12px;">WhatsApp</a></td></tr>`; });
    }

    window.adicionarNovaCategoria = async () => { const id = "cat_" + Date.now(); await setDoc(doc(db, "categorias_servicos", id), { nome: "Nova Categoria", itens: [] }); carregarServicos(); };
    window.switchTab = (tab) => { 
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active')); 
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active')); 
        document.getElementById(tab).classList.add('active'); 
        if(event && event.currentTarget) event.currentTarget.classList.add('active'); 
        
        if (tab === 'estatisticas') { window.carregarEstatisticas(); }
        if (tab === 'avaliacoes') { window.carregarAdminFeedbacks(); }
    };

    window.carregarAdminFeedbacks = async () => {
        const tbody = document.getElementById('lista-admin-feedbacks');
        if (!tbody) return;

        try {
            const q = query(collection(db, "feedbacks"), orderBy("data", "desc"));
            const snap = await getDocs(q);
            
            tbody.innerHTML = "";
            
            if (snap.empty) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Nenhuma avaliação encontrada.</td></tr>`;
                return;
            }

            snap.forEach(docSnap => {
                const f = docSnap.data();
                const id = docSnap.id;
                const dataFmt = f.data ? new Date(f.data).toLocaleDateString('pt-BR') : "--/--";
                
                let starsHtml = "";
                for(let i=1; i<=5; i++) {
                    if(i <= f.estrelas) starsHtml += '<i class="fas fa-star" style="color:var(--gold)"></i>';
                    else starsHtml += '<i class="far fa-star" style="color:var(--gold)"></i>';
                }

                tbody.innerHTML += `
                    <tr>
                        <td><span style="font-size:10px; color:var(--text-color)">${dataFmt}</span></td>
                        <td><strong>${f.nomeCliente || "Cliente"}</strong></td>
                        <td>${starsHtml}</td>
                        <td><span style="font-size:12px; color:var(--text-color); font-style:italic;">"${f.comentario}"</span></td>
                        <td>
                            <button class="btn-action btn-del" onclick="apagarFeedback('${id}')" title="Excluir Avaliação">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });
        } catch(e) {
            console.error("Erro ao carregar feedbacks:", e);
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">Erro ao carregar dados.</td></tr>`;
        }
    };

    window.apagarFeedback = async (id) => {
        const result = await Swal.fire({
            title: 'Remover Avaliação?',
            text: "Essa ação não pode ser desfeita.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ff4d4d',
            cancelButtonColor: '#333',
            confirmButtonText: 'Sim, excluir!'
        });

        if (result.isConfirmed) {
            try {
                await deleteDoc(doc(db, "feedbacks", id));
                Toast.fire({ icon: 'success', title: 'Avaliação removida!' });
                window.carregarAdminFeedbacks();
            } catch(e) {
                Swal.fire("Erro", "Falha ao remover.", "error");
            }
        }
    };
    function convMin(h) { if(!h) return 0; const [hrs, min] = h.split(':').map(Number); return hrs * 60 + (min || 0); }
    window.atualizarHorariosBloqueio = () => {
        const select = document.getElementById('bloqueio-hora-ini');
        if(select) { select.innerHTML = '<option value="">Início</option>'; horariosBase.forEach(h => { select.innerHTML += `<option value="${h}">${h}h</option>`; }); }
    };

// Variáveis globais do Agendamento Manual
let dataSelecionada = "";
let horaSelecionada = "";
// Gera o carrossel de datas igual ao do site
window.montarCarrosselDatas = () => {
    const container = document.getElementById('carrossel-datas');
    container.innerHTML = "";
    const hoje = new Date();
    const diasSemana = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
    for (let i = 0; i < 30; i++) {
        let d = new Date(); d.setDate(hoje.getDate() + i);
        let diaMes = d.getDate().toString().padStart(2, '0');
        let mes = (d.getMonth() + 1).toString().padStart(2, '0');
        let dataIso = `${d.getFullYear()}-${mes}-${diaMes}`;
        let item = document.createElement('div');
        item.className = 'data-item';
        item.innerHTML = `<span class="dia-semana">${diasSemana[d.getDay()]}</span><span class="dia-mes">${diaMes}/${mes}</span>`;
        item.onclick = () => {
            document.querySelectorAll('.data-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
            dataSelecionada = dataIso;
            window.gerarHorariosPorPeriodo();
        };
        container.appendChild(item);
    }
};

window.getTempoTotalSelecionado = () => {
    let t = 0;
    document.querySelectorAll('input[name="servico-manual"]:checked').forEach(m => t += parseInt(m.dataset.tempo || 30));
    return t > 0 ? t : 30; // Se nenhum selecionado, default 30 pra mostrar todos slots validos
};

// Gera os horários divididos por Manhã, Tarde e Noite
window.gerarHorariosPorPeriodo = async () => {
    if(!dataSelecionada) return;
    const ocupados = await window.obterHorariosOcupados(dataSelecionada);
    const duracaoDesejada = window.getTempoTotalSelecionado();
    
    const periodos = {
        manha: ["07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30"],
        tarde: ["12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"],
        noite: ["18:00", "18:30", "19:00", "19:30", "20:00"]
    };

    ["manha", "tarde", "noite"].forEach(p => {
        const grid = document.getElementById(`grid-${p}`);
        grid.innerHTML = "";
        periodos[p].forEach(h => {
            const passou = horarioJaPassou(dataSelecionada, h);
            const ocupado = window.verificarConflito(h, duracaoDesejada, ocupados);

            if (!ocupado && !passou) {
                let pill = document.createElement('div');
                pill.className = 'hora-pilula';
                if(horaSelecionada === h) pill.classList.add('active');
                pill.innerText = h;
                pill.onclick = () => {
                    document.querySelectorAll('.hora-pilula').forEach(el => el.classList.remove('active'));
                    pill.classList.add('active');
                    horaSelecionada = h;
                };
                grid.appendChild(pill);
            }
        });
    });

    // Se o selecionado anterior sumiu pq virou conflito, limpar
    let surv = false;
    document.querySelectorAll('#sessao-fazer-agenda .hora-pilula.active').forEach(el => surv = true);
    if(!surv) horaSelecionada = "";
};
let dataBloqueioSelecionada = "";
let horaBloqueioSelecionada = "";

// Função para montar o carrossel do Bloqueio (Copie e cole junto com a outra)
window.montarCarrosselBloqueio = () => {
    const container = document.getElementById('carrossel-datas-bloqueio');
    container.innerHTML = "";
    const hoje = new Date();
    const diasSemana = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
    
    for (let i = 0; i < 30; i++) {
        let d = new Date(); d.setDate(hoje.getDate() + i);
        let diaMes = d.getDate().toString().padStart(2, '0');
        let mes = (d.getMonth() + 1).toString().padStart(2, '0');
        let dataIso = `${d.getFullYear()}-${mes}-${diaMes}`;
        
        let item = document.createElement('div');
        item.className = 'data-item';
        item.innerHTML = `<span class="dia-semana">${diasSemana[d.getDay()]}</span><span class="dia-mes">${diaMes}/${mes}</span>`;
        item.onclick = () => {
            container.querySelectorAll('.data-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
            dataBloqueioSelecionada = dataIso;
            window.gerarHorariosBloqueio();
        };
        container.appendChild(item);
    }
};

window.gerarHorariosBloqueio = async () => {
    if(!dataBloqueioSelecionada) return;
    const ocupados = await window.obterHorariosOcupados(dataBloqueioSelecionada);
    
    let sel = document.getElementById('bloqueio-duracao');
    if(sel && !sel.dataset.listenerAttached) {
        sel.addEventListener('change', () => { if(dataBloqueioSelecionada) window.gerarHorariosBloqueio(); });
        sel.dataset.listenerAttached = "true";
    }
    const duracaoDesejada = sel ? parseInt(sel.value) : 60;

    const periodos = {
        manha: ["07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30"],
        tarde: ["12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"],
        noite: ["18:00", "18:30", "19:00", "19:30", "20:00"]
    };

    ["manha", "tarde", "noite"].forEach(p => {
        const grid = document.getElementById(`grid-${p}-bloqueio`);
        grid.innerHTML = "";
        periodos[p].forEach(h => {
            const ocupado = window.verificarConflito(h, duracaoDesejada, ocupados);
            if (!ocupado) {
                let pill = document.createElement('div');
                pill.className = 'hora-pilula';
                if(horaBloqueioSelecionada === h) pill.classList.add('active');
                pill.innerText = h;
                pill.onclick = () => {
                    document.querySelectorAll('#sessao-fazer-agenda .manual-box:last-child .hora-pilula').forEach(el => el.classList.remove('active'));
                    pill.classList.add('active');
                    horaBloqueioSelecionada = h;
                };
                grid.appendChild(pill);
            }
        });
    });

    let surv = false;
    document.querySelectorAll('#sessao-fazer-agenda .manual-box:last-child .hora-pilula.active').forEach(el => surv = true);
    if(!surv) horaBloqueioSelecionada = "";
};
// Função unificada para alternar sub-abas e manter o estilo CSS ativo
window.switchSubAgenda = (aba) => {
    document.getElementById('sessao-ver-agenda').style.display = aba === 'ver' ? 'block' : 'none';
    document.getElementById('sessao-fazer-agenda').style.display = aba === 'fazer' ? 'block' : 'none';
    
    const btnVer = document.getElementById('btn-sub-ver');
    const btnFazer = document.getElementById('btn-sub-fazer');
    if(btnVer) btnVer.classList.toggle('active', aba === 'ver');
    if(btnFazer) btnFazer.classList.toggle('active', aba === 'fazer');

    if(aba === 'fazer') {
        window.montarCarrosselDatas(); // Carrossel do Agendamento
        window.montarCarrosselBloqueio(); // Carrossel do Bloqueio
    }
};

// ATUALIZE sua função salvarBloqueio para usar as variáveis novas:
window.salvarBloqueio = async () => {
    if(!dataBloqueioSelecionada || !horaBloqueioSelecionada) {
        return Toast.fire({ icon: 'error', title: 'Selecione data e hora no carrossel!' });
    }
    
    const duracao = document.getElementById('bloqueio-duracao').value;
    const btn = document.querySelector('button[onclick="salvarBloqueio()"]');
    if(btn) { btn.innerText = "BLOQUEANDO..."; btn.disabled = true; }

    try {
        await addDoc(collection(db, "agendamentos"), { 
            clienteNome: "🚫 BLOQUEIO", 
            servicos: ["FOLGA/BLOQUEIO"], 
            data: dataBloqueioSelecionada, 
            hora: horaBloqueioSelecionada, 
            tempoTotal: parseInt(duracao), 
            status: "Confirmado" 
        });
        Swal.fire({ icon: 'success', title: 'Bloqueado!', text: 'Horário bloqueado com sucesso na agenda.', confirmButtonText: 'OK' });
        carregarAgenda();
        document.querySelectorAll('#sessao-fazer-agenda .manual-box:last-child .hora-pilula').forEach(el => el.classList.remove('active'));
        horaBloqueioSelecionada = "";
    } catch(e) {
        Swal.fire("Erro", "Falha ao bloquear o horário.", "error");
    } finally {
        if(btn) { btn.innerText = "CONFIRMAR BLOQUEIO 🔒"; btn.disabled = false; }
    }
};
window.verificarConflito = (horaSlot, duracaoDesejada, ocupados) => {
    const converterParaMinutos = (hhmm) => {
        if (!hhmm) return 0;
        const [h, m] = hhmm.split(':').map(Number);
        return h * 60 + m;
    };
    const inicioDesejado = converterParaMinutos(horaSlot);
    const fimDesejado = inicioDesejado + duracaoDesejada;

    for (let ag of ocupados) {
        const inicioOcupado = converterParaMinutos(ag.inicio);
        const fimOcupado = inicioOcupado + parseInt(ag.duracao || 30);
        if (inicioDesejado < fimOcupado && fimDesejado > inicioOcupado) {
            return true; 
        }
    }
    return false;
};

// Função que descobre todos os horários ocupados (Agendamentos + Bloqueios)
window.obterHorariosOcupados = async (data) => {
    const q = query(collection(db, "agendamentos"), where("data", "==", data));
    const snap = await getDocs(q);
    let ocupados = [];

    snap.forEach(doc => {
        const ag = doc.data();
        if (ag.status !== "Cancelado") {
            ocupados.push({
                inicio: ag.hora,
                duracao: parseInt(ag.tempoTotal) || 30
            });
        }
    });
    return ocupados;
};

// Função auxiliar para calcular horários (ex: 08:00 + 30 = 08:30)
// Função para somar minutos (ex: "08:00" + 30 = "08:30")
function somarMinutos(hora, minutos) {
    let [h, m] = hora.split(':').map(Number);
    let total = h * 60 + m + minutos;
    let novoH = Math.floor(total / 60).toString().padStart(2, '0');
    let novoM = (total % 60).toString().padStart(2, '0');
    return `${novoH}:${novoM}`;
}

// Função para saber se um horário já passou (comparando com a hora atual)
function horarioJaPassou(dataIso, horaPill) {
    const agora = new Date();
    const hojeIso = agora.toISOString().split('T')[0];
    
    if (dataIso < hojeIso) return true; // Datas passadas sempre bloqueadas
    if (dataIso > hojeIso) return false; // Datas futuras sempre liberadas
    
    // Se for hoje, compara as horas
    const [hPill, mPill] = horaPill.split(':').map(Number);
    const horaAtual = agora.getHours();
    const minAtual = agora.getMinutes();
    
    if (hPill < horaAtual) return true;
    if (hPill === horaAtual && mPill <= minAtual) return true;
    
    return false;
};

// Analytics Controller
let chartInstance = null;

window.carregarEstatisticas = async () => {
    const hojeObj = new Date();
    const mesAtual = (hojeObj.getMonth() + 1).toString().padStart(2, '0');
    const anoAtual = hojeObj.getFullYear();
    const diaHoje = hojeObj.getDate().toString().padStart(2, '0');
    const dataHojeIso = `${anoAtual}-${mesAtual}-${diaHoje}`;
    
    // Setup 30 day history baseline
    const labelsGrafico = [];
    const mapaFaturamento = {};
    for (let i = 29; i >= 0; i--) {
        let d = new Date();
        d.setDate(hojeObj.getDate() - i);
        let dia = d.getDate().toString().padStart(2, '0');
        let mes = (d.getMonth() + 1).toString().padStart(2, '0');
        let iso = `${d.getFullYear()}-${mes}-${dia}`;
        labelsGrafico.push(`${dia}/${mes}`);
        mapaFaturamento[iso] = 0;
    }

    let clientesHoje = 0;
    let faturamentoHoje = 0;
    let clientesMes = 0;

    // Fetch Only Finalized Appointments
    const q = query(collection(db, "agendamentos"), where("status", "==", "Finalizado"));
    const snap = await getDocs(q);

    snap.forEach(doc => {
        const d = doc.data();
        if (!d.data) return;

        if (d.data.startsWith(`${anoAtual}-${mesAtual}`)) { clientesMes++; }
        if (d.data === dataHojeIso) {
            clientesHoje++;
            faturamentoHoje += parseFloat(d.valorFinal || 0);
        }
        if (mapaFaturamento[d.data] !== undefined) {
            mapaFaturamento[d.data] += parseFloat(d.valorFinal || 0);
        }
    });

    const dadosGrafico = Object.values(mapaFaturamento);

    document.getElementById('stat-clientes-hoje').innerText = clientesHoje;
    document.getElementById('stat-faturamento-hoje').innerText = `R$ ${faturamentoHoje.toFixed(2).replace('.', ',')}`;
    document.getElementById('stat-clientes-mes').innerText = clientesMes;

    // Initialization details for Chart.js
    const ctx = document.getElementById('revenueChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();

    const textPrimary = document.documentElement.getAttribute('data-theme') === 'dark' ? '#fff' : '#000';
    const gridColor = document.documentElement.getAttribute('data-theme') === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labelsGrafico,
            datasets: [{
                label: 'Faturamento em R$',
                data: dadosGrafico,
                backgroundColor: '#d4af37',
                borderRadius: 5,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textPrimary } },
                x: { grid: { display: false }, ticks: { color: textPrimary, maxRotation: 45, minRotation: 45 } }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
};