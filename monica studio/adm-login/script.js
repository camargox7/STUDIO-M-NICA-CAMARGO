// Efeito do Loader
        window.addEventListener("load", function () {
            const loader = document.getElementById("loader");

            setTimeout(() => {
                loader.classList.add("loader-hidden");
            }, 800);
        });

        // VALIDAÇÃO DE USUÁRIO E SENHA
        document.getElementById('loginForm').addEventListener('submit', function (e) {

            e.preventDefault(); // Impede a página de recarregar sozinha

            const usuarioInserido = document.getElementById('usuario').value;
            const senhaInserida = document.getElementById('senha').value;
            const erro = document.getElementById('mensagemErro');

            // SEU USUÁRIO E SENHA FIXOS
            const usuarioCorreto = "Monica Camargo";
            const senhaCorreta = "2015";

            if (usuarioInserido === usuarioCorreto && senhaInserida === senhaCorreta) {

                // Se estiver certo, vai para o painel
                window.location.href = "../adm-painel/index.html";

            } else {

                // Se estiver errado, mostra a mensagem vermelha
                erro.style.display = 'block';

                // Limpa o campo de senha para tentar de novo
                document.getElementById('senha').value = '';
            }
        });