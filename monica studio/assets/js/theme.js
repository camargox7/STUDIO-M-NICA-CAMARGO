// theme.js
// Executa imediatamente para evitar o "piscar" da tela em branco (FOUC)
(function() {
    const theme = localStorage.getItem('site-theme') || 'light';
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
})();

document.addEventListener('DOMContentLoaded', () => {
    const theme = localStorage.getItem('site-theme') || 'light';
    
    // Tenta achar o botão de toggle em todas as páginas, caso exista
    const toggleBtns = document.querySelectorAll('.theme-toggle');
    
    toggleBtns.forEach(btn => {
        btn.innerHTML = theme === 'dark' ? '☀️' : '🌙';
        
        btn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            let newTheme = 'dark';
            
            if (currentTheme === 'dark') {
                newTheme = 'light';
                document.documentElement.removeAttribute('data-theme');
            } else {
                document.documentElement.setAttribute('data-theme', 'dark');
            }
            
            localStorage.setItem('site-theme', newTheme);
            
            // Atualiza o ícone de todos os botões na tela
            toggleBtns.forEach(b => b.innerHTML = newTheme === 'dark' ? '☀️' : '🌙');

            // Força a re-renderização de dados gráficos se estivermos na aba de Estatísticas do Admin
            if (typeof window.carregarEstatisticas === 'function') {
                const abaEst = document.getElementById('estatisticas');
                if (abaEst && abaEst.classList.contains('active')) {
                    window.carregarEstatisticas();
                }
            }
        });
    });
});
