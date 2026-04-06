import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
    import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
   import { getFirestore, doc, getDoc, collection, getDocs, addDoc, query, where, serverTimestamp, updateDoc, deleteDoc, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
    const firebaseConfig = {
        apiKey: "AIzaSyBJ6CccwzLWQZtkmUdJhoeqouWXU7vv_Sk",
        authDomain: "studio-monica.firebaseapp.com",
        projectId: "studio-monica",
        storageBucket: "studio-monica.firebasestorage.app",
        messagingSenderId: "138869623014",
        appId: "1:138869623014:web:55e0bf1fb8fcf7da431327"
    };

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);

    let usuarioLogado = null;
    let servicosSelecionados = [];
    let dataSelecionadaTrinks = "";
    let horarioSelecionadoTrinks = "";
    let tempoTotalAcumulado = 0;

    // --- SEGURANÇA CONTRA CARREGAMENTO INFINITO ---
    setTimeout(() => {
        const loader = document.getElementById("loader");
        if (loader && !loader.classList.contains("loader-hidden")) {
            loader.classList.add("loader-hidden");
            console.log("Loader removido por timeout de segurança.");
        }
    }, 5000);

    function formatarTempo(minutos) {
        if (minutos === 0) return "0min";
        const h = Math.floor(minutos / 60);
        const m = minutos % 60;
        return h > 0 ? `${h}h${m > 0 ? m + 'min' : ''}` : `${m}min`;
    }

    function gerarCalendario() {
        const grid = document.getElementById('dateGrid');
        grid.innerHTML = "";
        const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        for(let i=0; i<30; i++) {
            const data = new Date();
            data.setDate(data.getDate() + i);
            if (data.getDay() === 0) continue;
            const diaNum = data.getDate().toString().padStart(2, '0');
            const mesNum = (data.getMonth() + 1).toString().padStart(2, '0');
            const item = document.createElement('div');
            item.className = 'date-item';
            item.innerHTML = `<span>${diasSemana[data.getDay()]}</span><strong>${diaNum}/${mesNum}</strong>`;
            item.onclick = async () => { // Adicionei o async aqui
                document.querySelectorAll('.date-item').forEach(d => d.classList.remove('selected'));
                item.classList.add('selected');
                dataSelecionadaTrinks = `${data.getFullYear()}-${mesNum}-${diaNum}`;
                
                // Limpa os grids e avisa que está carregando (opcional, mas bom)
                document.getElementById('gridManha').innerHTML = "<small>Buscando...</small>";
                
                await gerarHorarios(); // Espera buscar no banco
            };
            grid.appendChild(item);
        }
    }

   // --- FUNÇÕES DE HORÁRIO COM BLOQUEIO INTELIGENTE ---
// --- FUNÇÕES DE HORÁRIO COM BLOQUEIO INTELIGENTE (CORRIGIDAS) ---

    function converterParaMinutos(hhmm) {
        if (!hhmm) return 0;
        const [h, m] = hhmm.split(':').map(Number);
        return h * 60 + m;
    }

    function verificarConflito(horaSlot, duracaoDesejada, ocupados) {
        const inicioDesejado = converterParaMinutos(horaSlot);
        const fimDesejado = inicioDesejado + duracaoDesejada;

        for (let ag of ocupados) {
            const inicioOcupado = converterParaMinutos(ag.inicio);
            const fimOcupado = inicioOcupado + (parseInt(ag.duracao) || 30);

            // Bloqueia se o serviço desejado "atropelar" um ocupado ou vice-versa
            if (inicioDesejado < fimOcupado && fimDesejado > inicioOcupado) {
                return true; 
            }
        }
        return false;
    }

    async function gerarHorarios() {
        if (!dataSelecionadaTrinks) return;

        try {
            const q = query(collection(db, "agendamentos"), where("data", "==", dataSelecionadaTrinks));
            const snap = await getDocs(q);
            
            const ocupados = [];
            snap.forEach(docSnap => {
                const ag = docSnap.data();
                if (ag.status !== "Cancelado") {
                    ocupados.push({
                        inicio: ag.hora,
                        duracao: parseInt(ag.tempoTotal || 30)
                    });
                }
            });

            const manha = ["07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30"];
            const tarde = ["12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"];
            const noite = ["18:00", "18:30", "19:00"];

            renderizarGrid('gridManha', manha, ocupados);
            renderizarGrid('gridTarde', tarde, ocupados);
            renderizarGrid('gridNoite', noite, ocupados);

            // Verifica se a seleção anterior ainda existe na tela, se não, limpa:
            let selectionSurvived = false;
            document.querySelectorAll('.time-item.selected').forEach(el => selectionSurvived = true);
            if(!selectionSurvived) horarioSelecionadoTrinks = "";

        } catch (error) {
            console.error("Erro ao gerar horários:", error);
            document.getElementById('gridManha').innerHTML = "<small>Erro ao carregar</small>";
        }
    }

    function renderizarGrid(id, lista, ocupados) {
        const container = document.getElementById(id); 
        if (!container) return;
        container.innerHTML = "";
        
        const tempoNecessarioCliente = (tempoTotalAcumulado > 0) ? tempoTotalAcumulado : 30; 
        
        const agora = new Date();
        const hoje = `${agora.getFullYear()}-${(agora.getMonth() + 1).toString().padStart(2, '0')}-${agora.getDate().toString().padStart(2, '0')}`;
        const horaAtualEmMinutos = (agora.getHours() * 60) + agora.getMinutes();

        lista.forEach(horaSlot => {
            const isOcupado = verificarConflito(horaSlot, tempoNecessarioCliente, ocupados);
            
            let isPassado = false;
            if (dataSelecionadaTrinks === hoje) {
                if (converterParaMinutos(horaSlot) <= horaAtualEmMinutos) {
                    isPassado = true;
                }
            }

            if (!isOcupado && !isPassado) {
                const item = document.createElement('div'); 
                item.className = 'time-item'; 
                if (horarioSelecionadoTrinks === horaSlot) item.classList.add('selected');
                item.innerText = horaSlot;
                item.onclick = () => { 
                    document.querySelectorAll('.time-item').forEach(t => t.classList.remove('selected')); 
                    item.classList.add('selected'); 
                    horarioSelecionadoTrinks = horaSlot; 
                };
                container.appendChild(item);
            }
        });

        if (container.innerHTML === "") {
            container.innerHTML = "<small style='color:#666; font-size:10px;'>Indisponível</small>";
        }
    }
    async function carregarServicos() {
        const grid = document.getElementById('gridServicosHome');
        const listaCheck = document.getElementById('listaServicosCheck');
        
        try {
            const snap = await getDocs(collection(db, "categorias_servicos"));
            grid.innerHTML = ""; listaCheck.innerHTML = "";
            snap.forEach(docSnap => {
                const cat = docSnap.data();
                const card = document.createElement('div'); card.className = 'service-card';
                card.innerHTML = `<h3>${cat.nome}</h3><p><i class="fas fa-eye"></i> Ver Procedimentos</p>`;
                card.onclick = () => {
                    document.getElementById('modalTitle').innerText = cat.nome;
                    document.getElementById('modalBody').innerHTML = (cat.itens || []).map(i => {
                        const tempoDisplay = formatarTempo(parseInt(i.tempo || 0));
                        const preco = (i.isVariavel === true || i.isVariavel === "true") ? `<a href="https://wa.me/5511974688863?text=Olá queria me informar sobre o Preço do(a): ${i.nome}" target="_blank" style="color:var(--gold-main); text-decoration:none;">Consultar</a>` : `R$ ${i.preco}`;
                        return `<div style="display:flex; justify-content:space-between; padding:15px 0; border-bottom:1px solid rgba(255,255,255,0.05);"><span>${i.nome}<br><small style="color:#666">⏱ ${tempoDisplay}</small></span><span style="color:var(--gold-main); font-weight:bold">${preco}</span></div>`;
                    }).join('');
                    document.getElementById('serviceModal').style.display = 'flex';
                };
                grid.appendChild(card);

                (cat.itens || []).forEach(i => {
                    const l = document.createElement('label'); l.style.display="flex"; l.style.padding="10px"; l.style.alignItems="center";
                    const isVariavel = (i.isVariavel === true || i.isVariavel === "true");
                    const precoTexto = isVariavel ? 'Consultar' : `R$ ${i.preco || '0,00'}`;
                    l.innerHTML = `<input type="checkbox" value="${i.nome}" data-preco="${i.preco||0}" data-tempo="${i.tempo||0}" data-isvariavel="${isVariavel}"> 
                                   <div style="margin-left:10px; font-size:13px;">${i.nome}<br><small style="color:var(--gold-main)">Preço: ${precoTexto}</small></div>`;
                    l.querySelector('input').addEventListener('change', () => {
                        let p = 0; tempoTotalAcumulado = 0; servicosSelecionados = []; let temVariavel = false;
                        document.querySelectorAll('#listaServicosCheck input:checked').forEach(c => { 
                            p += parseFloat(c.dataset.preco); 
                            tempoTotalAcumulado += parseInt(c.dataset.tempo); 
                            servicosSelecionados.push(c.value); 
                            if(c.dataset.isvariavel === "true") temVariavel = true;
                        });
                        let totalExibicao = temVariavel ? (p > 0 ? `R$ ${p.toFixed(2)} + Consultar` : `Consultar Valor`) : `R$ ${p.toFixed(2)}`;
                        document.getElementById('resumoAgendamento').innerHTML = `<div style="font-size: 16px; color: var(--gold-main); font-weight: 600;">Total: ${totalExibicao}</div><div style="font-size: 13px; color: #ddd; margin-top: 4px;">⏱ ${formatarTempo(tempoTotalAcumulado)}</div>`;

                        if (dataSelecionadaTrinks) gerarHorarios();
                    });
                    listaCheck.appendChild(l);
                });
            });
        } catch (error) {
            console.error("Erro ao carregar serviços:", error);
        } finally {
            document.getElementById("loader").classList.add("loader-hidden");
            // Adicionado para animar os serviços recém renderizados
            setTimeout(initScrollAnimations, 100);
        }
    }

   // --- COPIE E SUBSTITUA APENAS O SEU onAuthStateChanged POR ESTE ---

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const docSnap = await getDoc(doc(db, "clientes", user.uid));
            if (docSnap.exists()) document.getElementById('olaClienteHeader').innerText = "Olá, " + docSnap.data().nome.split(' ')[0];
            
            document.getElementById('btnSair').style.display = 'block';
            document.getElementById('linkLogin').style.display = 'none';

            window.clienteLogadoUid = user.uid;
            window.clienteLogadoNome = docSnap.exists() ? docSnap.data().nome : "Cliente";

            // Liberação da Avaliação
            const checkF = query(collection(db, "agendamentos"), where("clienteUid", "==", user.uid), where("status", "==", "Finalizado"));
            const snapF = await getDocs(checkF);
            if (!snapF.empty) {
                const checkFeedback = query(collection(db, "feedbacks"), where("userId", "==", user.uid));
                const snapFb = await getDocs(checkFeedback);
                if (snapFb.empty) {
                    const blockMsg = document.getElementById('feedback-bloqueado-msg');
                    const formContainer = document.getElementById('form-feedback-container');
                    if(blockMsg) blockMsg.style.display = 'none';
                    if(formContainer) formContainer.style.display = 'block';
                } else {
                    const blockMsg = document.getElementById('feedback-bloqueado-msg');
                    if(blockMsg) { blockMsg.innerText = "Você já deixou sua avaliação. Muito obrigado!"; blockMsg.style.display = 'block'; }
                }
            }

            // --- FUNÇÃO PARA CARREGAR OS HORÁRIOS NA TELA ---
           const carregarMeusAgendamentos = async () => {
                const lista = document.getElementById('listaCompromissos');
                const msgVazio = document.getElementById('msgVazio');
                const btnNovo = document.getElementById('btnNovoAgendamentoFinal');

                const q = query(collection(db, "agendamentos"), where("clienteUid", "==", user.uid));
                const snap = await getDocs(q);

                lista.innerHTML = "";

                if (snap.empty) {
                    msgVazio.style.display = "block";
                    btnNovo.style.display = "none";
                } else {
                    msgVazio.style.display = "none";
                    btnNovo.style.display = "block";
                    
                    snap.forEach(docSnap => {
                        const ag = docSnap.data();
                        const idAgendamento = docSnap.id;
                        
                        // Formatação do tempo (ex: 90 -> 1h30min)
                        const tempoFormatado = formatarTempo(ag.tempoTotal || 0);
                        
                        const card = document.createElement('div');
                        card.className = 'appointment-card';
                        
                            // Se não estiver cancelado, mostra "Cancelar". Se estiver cancelado, mostra "Apagar do Histórico"
                            let botoesHtml = "";

                            if (ag.status !== "Cancelado") {
                                botoesHtml = `
                                    <button onclick="cancelarHorario('${idAgendamento}')" 
                                        style="margin-top: 15px; width: 100%; padding: 8px; background: rgba(255, 77, 77, 0.1); border: 1px solid var(--red); color: var(--red); border-radius: 10px; font-size: 11px; font-weight: 600; cursor: pointer; text-transform: uppercase;">
                                        <i class="fas fa-times"></i> Cancelar Agendamento
                                    </button>`;
                            } else {
                                botoesHtml = `
                                    <button onclick="apagarAgendamento('${idAgendamento}')" 
                                        style="margin-top: 15px; width: 100%; padding: 8px; background: rgba(255, 255, 255, 0.05); border: 1px solid #666; color: #999; border-radius: 10px; font-size: 11px; font-weight: 600; cursor: pointer; text-transform: uppercase;">
                                        <i class="fas fa-trash-alt"></i> Remover do Histórico
                                    </button>`;
                            }

                            card.innerHTML = `
                                <span class="status-badge status-${ag.status.toLowerCase()}">${ag.status}</span>
                                <h4 style="color: var(--gold-main); margin-bottom: 8px;">${ag.servico}</h4>
                                
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12px; color: var(--text-color);">
                                    <span><i class="far fa-calendar-alt"></i> ${ag.data.split('-').reverse().join('/')}</span>
                                    <span><i class="far fa-clock"></i> ${ag.hora}</span>
                                    <span style="grid-column: span 2; opacity: 0.8;"><i class="fas fa-hourglass-half"></i> Duração: ${tempoFormatado}</span>
                                    <span style="grid-column: span 2; color: #2ecc71; font-weight: 600;"><i class="fas fa-money-bill-wave"></i> Valor Estimado: ${ag.precoTotal || (ag.valorFinal ? 'R$ '+ag.valorFinal : 'A Consultar')}</span>
                                </div>
                                
                                ${botoesHtml}
                            `;
                        lista.appendChild(card);
                    });
                }
            };

            // Chama a função para carregar assim que logar
            carregarMeusAgendamentos();

            document.getElementById('containerBotaoAgendamento').innerHTML = `<button class="btn-confirm" id="btnSalvar">CONFIRMAR AGENDAMENTO</button>`;
            document.getElementById('btnSalvar').onclick = async () => {
                if(!dataSelecionadaTrinks || !horarioSelecionadoTrinks || servicosSelecionados.length === 0) return alert("Por favor, preencha todos os campos!");
                
                document.getElementById('btnSalvar').innerText = "AGENDANDO...";
                document.getElementById('btnSalvar').disabled = true;

                await addDoc(collection(db, "agendamentos"), { 
                    clienteUid: user.uid, 
                    clienteNome: docSnap.data().nome, 
                    servico: servicosSelecionados.join(", "), 
                    data: dataSelecionadaTrinks, 
                    hora: horarioSelecionadoTrinks, 
                    tempoTotal: tempoTotalAcumulado,
                    status: "Pendente", 
                    criadoEm: serverTimestamp() 
                });
                
                document.getElementById('successNotification').style.display = 'flex';
            };
        } else {
            // Se não houver usuário, garante que a mensagem de vazio apareça
            document.getElementById('msgVazio').style.display = "block";
        }
    });

    document.getElementById('btnSair').onclick = () => signOut(auth).then(()=>location.reload());
    gerarCalendario(); 
    carregarServicos();

    window.switchTab = (id, el) => {
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        document.getElementById(id).classList.add('active');
        if(el) el.classList.add('active');
        window.scrollTo(0,0);
    };

    window.closeModalAndGo = () => { document.getElementById('serviceModal').style.display = 'none'; window.switchTab('aba-agendar', document.querySelectorAll('.nav-item')[1]); };
    document.getElementById('btnOpenMenu').onclick = () => { document.getElementById('sidebar').classList.add('active'); document.getElementById('menuOverlay').style.display = 'block'; };
    document.getElementById('btnCloseMenu').onclick = document.getElementById('menuOverlay').onclick = () => { document.getElementById('sidebar').classList.remove('active'); document.getElementById('menuOverlay').style.display = 'none'; };

 let idParaCancelar = null; // Variável temporária

    window.cancelarHorario = (id) => {
        idParaCancelar = id; // Guarda o ID
        document.getElementById('modalConfirmarCancelamento').style.display = 'flex'; // Abre o modal
    };

    // Ação do botão "SIM, CANCELAR" dentro do modal
    document.getElementById('btnConfirmarExplodir').onclick = async () => {
        if (!idParaCancelar) return;
        
        const btn = document.getElementById('btnConfirmarExplodir');
        btn.innerText = "CANCELANDO...";
        btn.disabled = true;

        try {
            const docRef = doc(db, "agendamentos", idParaCancelar);
            await updateDoc(docRef, { status: "Cancelado" });
            
            // Fecha o modal e recarrega
            document.getElementById('modalConfirmarCancelamento').style.display = 'none';
            location.reload(); 
        } catch (error) {
            console.error("Erro:", error);
            alert("Erro ao cancelar.");
            btn.innerText = "SIM, CANCELAR";
            btn.disabled = false;
        }
    };

   let idParaApagar = null;

    window.apagarAgendamento = (id) => {
        idParaApagar = id;
        document.getElementById('modalConfirmarApagar').style.display = 'flex';
    };

    // Ação do botão "SIM, REMOVER" dentro do modal novo
    document.getElementById('btnConfirmarExclusaoFinal').onclick = async () => {
        if (!idParaApagar) return;
        
        const btn = document.getElementById('btnConfirmarExclusaoFinal');
        btn.innerText = "REMOVENDO...";
        btn.disabled = true;

        try {
            const docRef = doc(db, "agendamentos", idParaApagar);
            await deleteDoc(docRef);
            
            document.getElementById('modalConfirmarApagar').style.display = 'none';
            location.reload(); 
        } catch (error) {
            console.error("Erro:", error);
            alert("Erro ao apagar registro.");
            btn.innerText = "SIM, REMOVER";
            btn.disabled = false;
        }
    };

    // --- INTERSECTION OBSERVER FOR ÉDITORIAL ANIMATIONS ---
    function initScrollAnimations() {
        const observerOptions = { root: null, rootMargin: '0px', threshold: 0.15 };
        const observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in-view');
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        document.querySelectorAll('.reveal-text, .fade-in-section, .brutal-img').forEach(el => observer.observe(el));
    }
    
    // --- PREMIUM CAROUSEL CLASS ---
    class PremiumCarousel {
        constructor(elementId) {
            this.container = document.getElementById(elementId);
            if (!this.container) return;
            this.track = this.container.querySelector('.carousel-premium-track');
            this.items = Array.from(this.track.children);
            this.indicatorsContainer = this.container.querySelector('.carousel-indicators');
            this.currentIndex = 0;
            this.isPlaying = false;
            this.intervalId = null;
            this.observer = null;
            this.isVisible = false;
            
            this.init();
        }

        init() {
            if (this.container.classList.contains('marquee-mode')) {
                // Marquee mode: duplicate elements for infinite CSS scrolling
                const cloneCount = 2; // Duplicar para preencher a tela inteira sem quebras no loop
                for (let i = 0; i < cloneCount; i++) {
                    this.items.forEach(item => {
                        const clone = item.cloneNode(true);
                        this.track.appendChild(clone);
                    });
                }
                if (this.indicatorsContainer) this.indicatorsContainer.style.display = 'none';
                return; // Impede a inicialização do javascript de carousel padrão (bolinhas, intersectionObserver)
            }

            if (this.indicatorsContainer) {
                this.indicatorsContainer.style.display = 'flex';
                this.indicatorsContainer.style.justifyContent = 'center';
                this.indicatorsContainer.style.gap = '10px';
                this.indicatorsContainer.style.marginTop = '20px';
                
                this.items.forEach((_, index) => {
                    const dot = document.createElement('div');
                    dot.style.width = '10px';
                    dot.style.height = '10px';
                    dot.style.borderRadius = '50%';
                    dot.style.background = index === 0 ? 'var(--gold-main)' : 'rgba(212, 175, 55, 0.3)';
                    dot.style.cursor = 'pointer';
                    dot.style.transition = '0.4s ease';
                    dot.addEventListener('click', () => this.goToSlide(index));
                    this.indicatorsContainer.appendChild(dot);
                });
            }

            this.container.addEventListener('mouseenter', () => this.pause());
            this.container.addEventListener('mouseleave', () => { if(this.isVisible) this.play(); });

            this.track.addEventListener('scroll', () => {
                clearTimeout(this.scrollTimeout);
                this.scrollTimeout = setTimeout(() => {
                    if (this.items.length === 0) return;
                    const scrollLeft = this.track.scrollLeft;
                    const itemWidth = this.items[0].offsetWidth;
                    const gap = parseInt(window.getComputedStyle(this.track).gap) || 0;
                    const totalItemWidth = itemWidth + gap;
                    const newIndex = Math.round(scrollLeft / totalItemWidth);
                    if(newIndex !== this.currentIndex && newIndex >= 0 && newIndex < this.items.length) {
                        this.currentIndex = newIndex;
                        this.updateIndicators();
                    }
                }, 150);
            });

            this.observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    this.isVisible = entry.isIntersecting;
                    if (this.isVisible) this.play();
                    else this.pause();
                });
            }, { threshold: 0.3 });
            this.observer.observe(this.container);
        }

        goToSlide(index) {
            if (this.items.length === 0) return;
            this.currentIndex = index;
            const itemWidth = this.items[0].offsetWidth;
            const gap = parseInt(window.getComputedStyle(this.track).gap) || 0;
            this.track.scrollTo({ left: index * (itemWidth + gap), behavior: 'smooth' });
            this.updateIndicators();
        }

        updateIndicators() {
            if (!this.indicatorsContainer) return;
            const dots = this.indicatorsContainer.children;
            for(let i=0; i<dots.length; i++) {
                dots[i].style.background = i === this.currentIndex ? 'var(--gold-main)' : 'rgba(212, 175, 55, 0.3)';
                dots[i].style.transform = i === this.currentIndex ? 'scale(1.2)' : 'scale(1)';
            }
        }

        play() {
            if (this.isPlaying) return;
            this.isPlaying = true;
            this.intervalId = setInterval(() => {
                let nextIndex = this.currentIndex + 1;
                if (nextIndex >= this.items.length) nextIndex = 0;
                this.goToSlide(nextIndex);
            }, 4000);
        }

        pause() {
            this.isPlaying = false;
            clearInterval(this.intervalId);
        }
    }

    // Iniciar animações no load
    document.addEventListener('DOMContentLoaded', () => {
        initScrollAnimations();
        new PremiumCarousel('certificadosCarousel');
        new PremiumCarousel('salaoCarousel');
        new PremiumCarousel('servicosCarousel');
    });
    
    setTimeout(() => {
        initScrollAnimations();
        new PremiumCarousel('certificadosCarousel');
        new PremiumCarousel('salaoCarousel');
        new PremiumCarousel('servicosCarousel');
    }, 500);

// --- FEEDBACK SYSTEM ---
let pontuacaoSelecionada = 0;

const initFeedbackUI = () => {
    // Star Rating Interactivity
    const stars = document.querySelectorAll('.star-btn');
    stars.forEach(star => {
        star.addEventListener('click', (e) => {
            pontuacaoSelecionada = parseInt(e.target.dataset.val);
            stars.forEach(s => {
                if (parseInt(s.dataset.val) <= pontuacaoSelecionada) {
                    s.classList.remove('far');
                    s.classList.add('fas');
                } else {
                    s.classList.remove('fas');
                    s.classList.add('far');
                }
            });
        });
    });

    if (document.getElementById('lista-feedbacks')) {
        window.carregarFeedbacks();
    }
};

setTimeout(initFeedbackUI, 600);

window.enviarFeedback = async () => {
    if (!window.clienteLogadoUid) {
        return Swal.fire("Atenção", "Você precisa estar logado para avaliar.", "warning");
    }
    if (pontuacaoSelecionada === 0) {
        return Swal.fire("Atenção", "Por favor, selecione uma nota de 1 a 5 estrelas.", "warning");
    }
    const comentario = document.getElementById('feedback-texto').value.trim();
    if (!comentario) {
        return Swal.fire("Atenção", "Por favor, escreva um comentário.", "warning");
    }

    const btn = document.querySelector('#form-feedback-container button');
    btn.disabled = true; btn.innerText = "ENVIANDO...";

    try {
        await addDoc(collection(db, "feedbacks"), {
            userId: window.clienteLogadoUid,
            nomeCliente: window.clienteLogadoNome || "Visitante",
            estrelas: pontuacaoSelecionada,
            comentario: comentario,
            data: new Date().toISOString()
        });
        Swal.fire("Sucesso!", "Muito obrigado pela sua avaliação!", "success");
        document.getElementById('feedback-texto').value = '';
        pontuacaoSelecionada = 0;
        document.querySelectorAll('.star-btn').forEach(s => { s.classList.remove('fas'); s.classList.add('far'); });
        document.getElementById('form-feedback-container').style.display = 'none';
        
        const blockMsg = document.getElementById('feedback-bloqueado-msg');
        if(blockMsg) {
            blockMsg.style.display = 'block';
            blockMsg.innerText = "Sua avaliação foi registrada com sucesso, obrigado!";
        }
    } catch(e) {
        Swal.fire("Erro", "Falha ao enviar avaliação.", "error");
    } finally {
        if(btn) { btn.disabled = false; btn.innerText = "ENVIAR AVALIAÇÃO"; }
    }
};

window.carregarFeedbacks = async () => {
    const lista = document.getElementById('lista-feedbacks');
    if (!lista) return;

    // Real-time listener for feedbacks
    onSnapshot(query(collection(db, "feedbacks"), orderBy("data", "desc")), (snap) => {
        let totalEstrelas = 0;
        let qtd = 0;
        lista.innerHTML = "";

        if (snap.empty) {
            lista.innerHTML = "<p style='text-align: center; color: var(--grey-dark);'>Seja o primeiro a avaliar!</p>";
            document.getElementById('media-estrelas').innerText = "0.0";
            document.getElementById('total-avaliacoes').innerText = "0 Avaliações";
            return;
        }

        snap.forEach(docSnap => {
            const f = docSnap.data();
            totalEstrelas += f.estrelas;
            qtd++;

            let starsHtml = "";
            for(let i=1; i<=5; i++) {
                if(i <= f.estrelas) starsHtml += '<i class="fas fa-star"></i>';
                else starsHtml += '<i class="far fa-star"></i>';
            }

            const dataFmt = f.data ? new Date(f.data).toLocaleDateString('pt-BR') : "";

            const card = document.createElement('div');
            card.className = "service-card"; // Reusing the dark luxury card style
            card.style.padding = "20px";
            card.style.textAlign = "left";
            card.style.margin = "0 auto";
            card.style.maxWidth = "600px";
            card.style.width = "100%";
            card.style.border = "1px solid var(--gold-main)";
            card.style.borderRadius = "15px";
            card.style.background = "var(--black-pure)";
            
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <strong style="color: var(--gold-main); font-family: var(--font-heading); font-size: 1.1rem;">${f.nomeCliente}</strong>
                    <span style="color: var(--grey-light); font-size: 10px;">${dataFmt}</span>
                </div>
                <div style="color: var(--gold-main); font-size: 12px; margin-bottom: 10px;">${starsHtml}</div>
                <p style="color: var(--white-pure); font-size: 13px; line-height: 1.5; font-style: italic; margin-bottom:0;">"${f.comentario}"</p>
            `;
            lista.appendChild(card);
        });

        // Calc average
        const media = (totalEstrelas / qtd).toFixed(1);
        document.getElementById('media-estrelas').innerText = media;
        document.getElementById('total-avaliacoes').innerText = `${qtd} Avaliações`;

        let mediaHtml = "";
        const mediaInt = Math.round(media);
        for(let i=1; i<=5; i++) {
            if(i <= mediaInt) mediaHtml += '<i class="fas fa-star"></i>';
            else mediaHtml += '<i class="far fa-star"></i>';
        }
        document.getElementById('media-icones').innerHTML = mediaHtml;
    });
};