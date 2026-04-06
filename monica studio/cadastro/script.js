import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
        import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
        import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

        // Remover Loader
        window.addEventListener("load", () => {
            setTimeout(() => document.getElementById("loader").classList.add("loader-hidden"), 800);
        });

        function mostrarAlerta(msg) {
            const box = document.getElementById('meuAlerta');
            box.innerText = msg; box.style.display = 'block';
            setTimeout(() => { box.style.display = 'none'; }, 3000);
        }

        // MÁSCARA DO WHATSAPP (Apenas números e formatação automática)
        const inputTel = document.getElementById('telefone');
        inputTel.addEventListener('input', (e) => {
            let v = e.target.value.replace(/\D/g, ""); 
            if (v.length > 11) v = v.slice(0, 11);
            if (v.length > 10) {
                v = v.replace(/^(\d{2})(\d{5})(\d{4}).*/, "($1) $2-$3");
            } else if (v.length > 5) {
                v = v.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, "($1) $2-$3");
            } else if (v.length > 2) {
                v = v.replace(/^(\d{2})(\d{0,5})/, "($1) $2");
            } else if (v.length > 0) {
                v = v.replace(/^(\d*)/, "($1");
            }
            e.target.value = v;
        });

        // SALVAR NO FIREBASE
        document.getElementById('btnCadastrar').onclick = async () => {
            const nome = document.getElementById('nome').value;
            const tel = document.getElementById('telefone').value;
            const email = document.getElementById('email').value;
            const senha = document.getElementById('senha').value;

            if(!nome || !tel || !email || !senha) {
                mostrarAlerta("⚠️ Preencha todos os campos!");
                return;
            }

            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
                const user = userCredential.user;

                await setDoc(doc(db, "clientes", user.uid), {
                    nome: nome,
                    telefone: tel,
                    email: email,
                    uid: user.uid
                });

                mostrarAlerta("✅ Cadastro realizado com sucesso!");
                setTimeout(() => { window.location.href = "../index.html"; }, 2000);

            } catch (error) {
                let erroMsg = "❌ Erro ao cadastrar.";
                if(error.code === 'auth/email-already-in-use') erroMsg = "❌ E-mail já cadastrado!";
                if(error.code === 'auth/weak-password') erroMsg = "❌ Senha muito fraca (mín. 6 dígitos)!";
                mostrarAlerta(erroMsg);
            }
        };