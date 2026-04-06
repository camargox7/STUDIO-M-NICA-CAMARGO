import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
        import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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

        document.getElementById('formLogin').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const senha = document.getElementById('senha').value;
            const btn = document.getElementById('btnEntrar');

            btn.innerText = "CARREGANDO...";
            btn.disabled = true;

            try {
                await signInWithEmailAndPassword(auth, email, senha);
                window.location.href = "../index.html"; // Redireciona para a home
            } catch (error) {
                console.error(error);
                alert("E-mail ou senha incorretos!");
                btn.innerText = "ENTRAR";
                btn.disabled = false;
            }
        });

        // Loader
        window.addEventListener("load", function () {
            const loader = document.getElementById("loader");
            setTimeout(() => {
                loader.classList.add("loader-hidden");
            }, 800);
        });