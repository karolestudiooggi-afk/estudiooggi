// --- 1. CONFIGURAÇÃO DO SUPABASE ---
// ✅ NOVAS CREDENCIAIS ATUALIZADAS
const SUPABASE_URL = 'https://yhbahduwkndfxxhvnufz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InloYmFoZHV3a25kZnh4aHZudWZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzMjA1NTAsImV4cCI6MjA3ODg5NjU1MH0.gBIvqu8a8J0v_OEMjmXEyJ1X3ujZ9bJxd1qSIpkyA3s';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- 2. LÓGICA DA PÁGINA ---
// @ts-ignore Ignora erro TS se document não estiver definido (caso raro)
if (document.title.includes("Login")) {
    /**************************/
    /* ESTAMOS NO LOGIN.HTML  */
    /**************************/
    console.log("Auth.js: Página de Login");

    // Configura a troca entre forms (animação de slide)
    setupFormSwitching();

    // Seleciona os forms
    // @ts-ignore
    const formLogin = document.getElementById('form-login');
    // @ts-ignore
    const formCadastro = document.getElementById('form-cadastro');
    
    // Seleciona o botão de "Esqueci a senha"
    // @ts-ignore
    const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
    
    // Seleciona os elementos do Modal de Senha
    // @ts-ignore
    const modalOverlay = document.getElementById('modalOverlay');
    // @ts-ignore
    const closeModalBtn = document.getElementById('closeModalBtn');
    // @ts-ignore
    const resetForm = document.getElementById('resetForm');


    // Liga o form de LOGIN
    if (formLogin) {
        formLogin.addEventListener('submit', async (e) => {
            e.preventDefault();
            // @ts-ignore
            const email = document.getElementById('email-login').value;
            // @ts-ignore
            const senha = document.getElementById('senha-login').value;
            // @ts-ignore
            document.getElementById('login-error').textContent = ''; 
            await logarUsuario(email, senha);
        });
    }

    // Liga o form de CADASTRO
    if (formCadastro) {
        formCadastro.addEventListener('submit', async (e) => {
            e.preventDefault();
            // @ts-ignore
            const email = document.getElementById('email-cadastro').value;
            // @ts-ignore
            const senha = document.getElementById('senha-cadastro').value;
            // @ts-ignore
            document.getElementById('cadastro-error').textContent = ''; 
            // @ts-ignore
            document.getElementById('cadastro-success').textContent = ''; 
            await cadastrarUsuario(email, senha);
        });
    }
    
    // Liga o botão de "Esqueci a senha" para ABRIR O MODAL
    if (forgotPasswordBtn) {
        forgotPasswordBtn.addEventListener('click', (e) => {
            e.preventDefault(); 
            openResetModal();
        });
    }

    // Liga os botões de FECHAR O MODAL de Senha
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeResetModal);
    if (modalOverlay) modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeResetModal();
    });
    
    // Liga o form de SUBMISSÃO do modal de Senha
    if (resetForm) {
        resetForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handlePasswordReset();
        });
    }

} else {
    /**************************/
    /* ESTAMOS NO INDEX.HTML  */
    /**************************/
    console.log("Auth.js: Página Principal (App)");

    // *** O PULO DO GATO DE SEGURANÇA ***
    verificarLogin(); // Esta função foi corrigida para NÃO dar alert

    // Procura o botão de Sair (agora dentro do dropdown do perfil)
    // @ts-ignore
    document.addEventListener('DOMContentLoaded', () => {
        // @ts-ignore
        const profileLogoutBtn = document.getElementById('profileLogoutBtn');
        if (profileLogoutBtn) {
            profileLogoutBtn.addEventListener('click', fazerLogout);
        } else {
            // Verifica se o botão antigo ainda existe por engano
            // @ts-ignore
            const oldLogoutBtn = document.getElementById('btnLogout');
            if (oldLogoutBtn) {
                 console.warn("Encontrado botão antigo #btnLogout. Use #profileLogoutBtn.");
                 oldLogoutBtn.addEventListener('click', fazerLogout);
            } else {
                 console.error("Botão de Logout (#profileLogoutBtn) não encontrado!");
            }
        }
    });
}

// --- 3. FUNÇÕES DE AUTENTICAÇÃO ---

/**
 * Registra um novo usuário.
 */
async function cadastrarUsuario(email, password) {
    // @ts-ignore
    const nome = document.getElementById('nome-cadastro').value;
    // @ts-ignore
    const cadastroErrorEl = document.getElementById('cadastro-error');
    // @ts-ignore
    const cadastroSuccessEl = document.getElementById('cadastro-success');

    if (!nome && cadastroErrorEl) {
        cadastroErrorEl.textContent = "Por favor, preencha seu nome.";
        return;
    }

    // @ts-ignore
    const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
            data: { nome_completo: nome }
        }
    });

    if (error && cadastroErrorEl) {
        console.error("Erro no cadastro:", error.message);
        if (error.message.includes("Password should be at least 6 characters")) {
            cadastroErrorEl.textContent = "A senha deve ter no mínimo 6 caracteres.";
        } else if (error.message.includes("User already registered")) {
            cadastroErrorEl.textContent = "Este e-mail já está cadastrado.";
        } else {
            cadastroErrorEl.textContent = "Erro: " + error.message;
        }
    } else if (cadastroSuccessEl) {
        console.log("Cadastro feito!", data?.user);
        cadastroSuccessEl.textContent = "Sucesso! Verifique seu e-mail para confirmar a conta.";
        // @ts-ignore
        document.getElementById('form-cadastro')?.reset();
    }
}

/**
 * Loga um usuário existente.
 */
async function logarUsuario(email, password) {
    // @ts-ignore
    const loginErrorEl = document.getElementById('login-error');

    // @ts-ignore
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
    });

    if (error && loginErrorEl) {
        console.error("Erro no login:", error.message);
        if (error.message.includes("Invalid login credentials")) {
            loginErrorEl.textContent = "E-mail ou senha inválidos.";
        } else if (error.message.includes("Email not confirmed")) {
            loginErrorEl.textContent = "Você precisa confirmar seu e-mail antes de logar.";
        } else {
            loginErrorEl.textContent = "Erro: " + error.message;
        }
    } else {
        console.log("Logado!", data?.user);
        // @ts-ignore
        window.location.href = '/index.html'; 
    }
}

/**
 * Desloga o usuário atual.
 */
async function fazerLogout() {
    console.log("Deslogando...");
    // @ts-ignore
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error("Erro ao sair:", error.message);
        // @ts-ignore
        alert("Erro ao sair: " + error.message);
    } else {
        // @ts-ignore
        window.location.href = '/login.html';
    }
}

// ==========================================================
// MUDANÇA IMPORTANTE AQUI - REMOVIDO ALERT E CHAMADA startApp
// ==========================================================
/**
 * Verifica se o usuário tem uma sessão ativa.
 */
async function verificarLogin() {
    // @ts-ignore
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
        console.error("Erro ao buscar sessão:", error.message);
        // @ts-ignore
        window.location.href = '/login.html';
        return;
    }

    if (!session) {
        console.warn("Acesso negado! Ninguém logado.");
        // @ts-ignore
        window.location.href = '/login.html';
    } else {
        console.log('Login verificado. Bem-vindo!', session.user.email);
        // **NÃO FAZ MAIS NADA AQUI** // O script.js vai carregar e rodar o initializeApp() sozinho.
    }
}
// ==========================================================
// FIM DA MUDANÇA
// ==========================================================

/**
 * Abre o modal de reset de senha.
 */
function openResetModal() {
    // @ts-ignore
    const modalOverlay = document.getElementById('modalOverlay');
    // @ts-ignore
    const passwordResetModal = document.getElementById('passwordResetModal');
    // @ts-ignore
    const modalMessage = document.getElementById('modalMessage');
    // @ts-ignore
    const resetEmailInput = document.getElementById('resetEmailInput');

    if (modalMessage) {
        modalMessage.textContent = '';
        modalMessage.className = 'modal-message';
    }
    if (resetEmailInput) resetEmailInput.value = '';
    
    if (modalOverlay) modalOverlay.classList.remove('hidden');
    if (passwordResetModal) passwordResetModal.classList.remove('hidden');
}

/**
 * Fecha o modal de reset de senha.
 */
function closeResetModal() {
    // @ts-ignore
    const modalOverlay = document.getElementById('modalOverlay');
    // @ts-ignore
    const passwordResetModal = document.getElementById('passwordResetModal');
    
    if (modalOverlay) modalOverlay.classList.add('hidden');
    if (passwordResetModal) passwordResetModal.classList.add('hidden');
}

/**
 * Envia o e-mail de reset usando o e-mail do input do modal.
 */
async function handlePasswordReset() {
    // @ts-ignore
    const emailInput = document.getElementById('resetEmailInput');
    const email = emailInput?.value;
    // @ts-ignore
    const modalMessage = document.getElementById('modalMessage');
    // @ts-ignore
    const submitButton = document.querySelector('#resetForm button[type="submit"]');

    if (!email && modalMessage) {
        modalMessage.textContent = 'Por favor, digite um e-mail.';
        modalMessage.className = 'modal-message error-message';
        return;
    }
    
    if (submitButton) {
         submitButton.disabled = true;
         submitButton.textContent = 'Enviando...';
    }
    if (modalMessage) {
         modalMessage.textContent = '';
         modalMessage.className = 'modal-message';
    }

    // @ts-ignore
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        // @ts-ignore
        redirectTo: window.location.origin + '/login.html' 
    });

    if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Enviar Link';
    }

    if (error && modalMessage) {
        console.error("Erro ao resetar senha:", error.message);
        modalMessage.textContent = 'Erro ao enviar e-mail. Tente novamente mais tarde.';
        modalMessage.className = 'modal-message error-message';
    } else if (modalMessage) {
        console.log("Solicitação de reset de senha enviada.");
        modalMessage.textContent = 'Link enviado! Verifique sua caixa de entrada (e spam).';
        modalMessage.className = 'modal-message success-message';
        setTimeout(closeResetModal, 3000);
    }
}

/**
 * Configura a lógica para a ANIMAÇÃO DE SLIDE
 */
function setupFormSwitching() {
    // @ts-ignore
    const container = document.getElementById('loginMainContainer');
    // @ts-ignore
    const signUpBtn = document.getElementById('signUpBtn'); 
    // @ts-ignore
    const signInBtn = document.getElementById('signInBtn'); 
    
    // Adiciona botões de troca para mobile
    // @ts-ignore
    if (!document.getElementById('mobileSwitchToLogin')) {
        // @ts-ignore
        const formCadastro = document.querySelector('.sign-up-container form');
        if (formCadastro) formCadastro.innerHTML += '<button type="button" id="mobileSwitchToLogin" class="mobile-switch-btn">Já tem conta? Entrar.</button>';
    }
    // @ts-ignore
    if (!document.getElementById('mobileSwitchToSignUp')) {
        // @ts-ignore
        const formLogin = document.querySelector('.sign-in-container form');
        if (formLogin) formLogin.innerHTML += '<button type="button" id="mobileSwitchToSignUp" class="mobile-switch-btn">Não tem conta? Cadastrar.</button>';
    }

    // @ts-ignore
    const mobileSwitchToLogin = document.getElementById('mobileSwitchToLogin');
    // @ts-ignore
    const mobileSwitchToSignUp = document.getElementById('mobileSwitchToSignUp');

    function clearMessages() {
        // @ts-ignore
        const loginError = document.getElementById('login-error');
        // @ts-ignore
        const cadastroError = document.getElementById('cadastro-error');
        // @ts-ignore
        const cadastroSuccess = document.getElementById('cadastro-success');
        if (loginError) loginError.textContent = '';
        if (cadastroError) cadastroError.textContent = '';
        if (cadastroSuccess) cadastroSuccess.textContent = '';
    }

    function switchToLogin() {
        if (container) container.classList.remove('right-panel-active');
        clearMessages();
    }

    function switchToCadastro() {
        if (container) container.classList.add('right-panel-active');
        clearMessages();
    }

    // Liga os botões (desktop)
    if (signInBtn) signInBtn.addEventListener('click', switchToLogin);
    if (signUpBtn) signUpBtn.addEventListener('click', switchToCadastro);
    
    // Liga os botões (mobile)
    if (mobileSwitchToLogin) mobileSwitchToLogin.addEventListener('click', switchToLogin);
    if (mobileSwitchToSignUp) mobileSwitchToSignUp.addEventListener('click', switchToCadastro);
}