// --- CONFIGURAÇÃO GLOBAL ---
const WEBHOOK_URL = 'https://n8n.ingaedulis.com/webhook/agente-oggi';

// --- ELEMENTOS DO DOM ---
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const newChatBtn = document.getElementById('newChatBtn');
const chatHistory = document.getElementById('chatHistory');
const sidebarToggle = document.getElementById('sidebarToggle');
const sidebar = document.getElementById('sidebarElement');
const themeToggle = document.getElementById('themeToggle');
const collapseSidebarBtn = document.getElementById('collapseSidebarBtn');
const activeChatsList = document.getElementById('chatTabs');

// Modal de Deletar
const deleteModalOverlay = document.getElementById('deleteModalOverlay');
const confirmDeleteModal = document.getElementById('confirmDeleteModal');
const closeDeleteModalBtn = document.getElementById('closeDeleteModalBtn');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
const deleteModalMessage = document.getElementById('deleteModalMessage');

// Perfil
const userProfile = document.getElementById('userProfile');
const profileAvatar = document.getElementById('profileAvatar');
const profileName = document.getElementById('profileName');
const profileEmail = document.getElementById('profileEmail');
const profileLogoutBtn = document.getElementById('profileLogoutBtn');

// --- ESTADO DO APLICATIVO ---
let chatSessions = [];
let currentSessionId = null;
let currentTypingIndicator = null;
let sessionIdToDelete = null;
let currentUser = null;
let isProcessing = false; // ✅ NOVO: Controla se está processando

// --- FUNÇÕES SUPABASE ---

// Carregar salas do usuário (AGORA SÓ DO PRÓPRIO USUÁRIO)
async function loadRoomsFromSupabase() {
    try {
        console.log('🔍 Carregando salas para usuário:', currentUser.id);
        const { data: rooms, error } = await supabase
            .from('salas')
            .select('*')
            .eq('user_id', currentUser.id) // SÓ TRAZ AS SALAS DO USUÁRIO ATUAL
            .order('created_at', { ascending: false });

        if (error) {
            console.error('❌ Erro ao carregar salas:', error);
            throw error;
        }
        
        console.log('✅ Salas carregadas:', rooms?.length || 0);
        return rooms || [];
    } catch (error) {
        console.error('💥 Erro fatal ao carregar salas:', error);
        return [];
    }
}

// Carregar mensagens de uma sala (VERIFICA SE É DO USUÁRIO)
async function loadMessagesFromRoom(roomId) {
    try {
        // VERIFICA SE A SALA PERTENCE AO USUÁRIO ANTES DE CARREGAR MENSAGENS
        const { data: room, error: roomError } = await supabase
            .from('salas')
            .select('id')
            .eq('id', roomId)
            .eq('user_id', currentUser.id)
            .single();

        if (roomError || !room) {
            console.error('❌ Acesso negado: sala não pertence ao usuário');
            return [];
        }

        const { data: messages, error } = await supabase
            .from('mensagens')
            .select('*')
            .eq('sala_id', roomId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return messages || [];
    } catch (error) {
        console.error('Erro ao carregar mensagens:', error);
        return [];
    }
}

// Criar nova sala (SEMPRE ASSOCIA AO USUÁRIO ATUAL)
async function createRoomInSupabase(title = 'Nova conversa') {
    try {
        // ✅ VALIDAÇÃO: Verifica se usuário está autenticado
        if (!currentUser || !currentUser.id) {
            console.error('❌ Usuário não autenticado. currentUser:', currentUser);
            throw new Error('Usuário não autenticado');
        }

        console.log('➕ Criando nova sala no Supabase...');
        console.log('   - Título:', title);
        console.log('   - User ID:', currentUser.id);
        
        const { data: room, error } = await supabase
            .from('salas')
            .insert([
                { 
                    nome: title,
                    user_id: currentUser.id // SEMPRE ASSOCIA AO USUÁRIO ATUAL
                }
            ])
            .select()
            .single();

        if (error) {
            console.error('❌ Erro ao criar sala:', error);
            console.error('   - Código:', error.code);
            console.error('   - Mensagem:', error.message);
            console.error('   - Detalhes:', error.details);
            console.error('   - Hint:', error.hint);
            throw error;
        }
        
        if (!room) {
            console.error('❌ Sala retornou null/undefined');
            throw new Error('Sala não foi criada');
        }
        
        console.log('✅ Sala criada com sucesso!');
        console.log('   - ID:', room.id);
        console.log('   - Nome:', room.nome);
        return room;
    } catch (error) {
        console.error('💥 Erro fatal ao criar sala:', error);
        
        // Mostra mensagem de erro mais clara pro usuário
        if (error.message?.includes('violates row-level security')) {
            console.error('🔒 Problema de permissão (RLS). Verifique as políticas no Supabase.');
        } else if (error.message?.includes('not found')) {
            console.error('📋 Tabela "salas" não encontrada. Verifique o Supabase.');
        }
        
        return null;
    }
}

// Salvar mensagem no Supabase (VERIFICA PERMISSÃO)
async function saveMessageToSupabase(roomId, sender, content, content_formatted = null) {
    try {
        // VERIFICA SE A SALA PERTENCE AO USUÁRIO ANTES DE SALVAR
        const { data: room, error: roomError } = await supabase
            .from('salas')
            .select('id')
            .eq('id', roomId)
            .eq('user_id', currentUser.id)
            .single();

        if (roomError || !room) {
            console.error('❌ Acesso negado: não pode salvar mensagem em sala de outro usuário');
            return null;
        }

        const { data: message, error } = await supabase
            .from('mensagens')
            .insert([
                {
                    sala_id: roomId,
                    user_id: currentUser.id, // SEMPRE ASSOCIA AO USUÁRIO ATUAL
                    sender: sender,
                    content: content,
                    content_formatted: content_formatted
                }
            ])
            .select()
            .single();

        if (error) throw error;
        return message;
    } catch (error) {
        console.error('Erro ao salvar mensagem:', error);
        return null;
    }
}

// Atualizar nome da sala (VERIFICA PERMISSÃO)
async function updateRoomName(roomId, newName) {
    try {
        const { error } = await supabase
            .from('salas')
            .update({ nome: newName })
            .eq('id', roomId)
            .eq('user_id', currentUser.id); // SÓ ATUALIZA SE FOR DO USUÁRIO

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Erro ao atualizar sala:', error);
        return false;
    }
}

// Deletar sala (VERIFICA PERMISSÃO)
async function deleteRoomFromSupabase(roomId) {
    try {
        const { error } = await supabase
            .from('salas')
            .delete()
            .eq('id', roomId)
            .eq('user_id', currentUser.id); // SÓ DELETA SE FOR DO USUÁRIO

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Erro ao deletar sala:', error);
        return false;
    }
}

// --- FUNÇÕES AUXILIARES ---
function autoResize() {
    if (messageInput) {
        messageInput.style.height = 'auto';
        messageInput.style.height = messageInput.scrollHeight + 'px';
    }
}

function toggleTheme() {
    document.body.classList.toggle('light-mode');
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.body.classList.remove('dark-mode', 'light-mode');
    document.body.classList.add(savedTheme + '-mode');
}

function formatBotMessage(text) {
    if (!text) return '';
    let formattedText = String(text);
    formattedText = formattedText.replace(/\n/g, '<br>');
    formattedText = formattedText.replace(/\n- /g, '<br>• ');
    formattedText = formattedText.replace(/\n\* /g, '<br>• ');
    formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    formattedText = formattedText.replace(/(<br>){2,}/g, '<br><br>');
    return formattedText;
}

function addTypingIndicator() {
    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper bot';
    wrapper.id = 'typing-indicator';
    
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'message-content-wrapper';
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar bot';
    const img = document.createElement('img');
    img.src = 'imagens/logo.png';
    img.alt = 'OGGI';
    avatar.appendChild(img);
    
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    for (let i = 0; i < 3; i++) {
        const dot = document.createElement('div');
        dot.className = 'typing-dot';
        indicator.appendChild(dot);
    }
    
    contentWrapper.appendChild(avatar);
    contentWrapper.appendChild(indicator);
    wrapper.appendChild(contentWrapper);
    
    if (messagesContainer) {
        messagesContainer.appendChild(wrapper);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    return wrapper;
}

function addMessageToContainer(text, sender, isHTML = false) {
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${sender}`;
    
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'message-content-wrapper';
    
    const avatar = document.createElement('div');
    avatar.className = `message-avatar ${sender}`;
    
    if (sender === 'user') {
        avatar.textContent = currentUser?.user_metadata?.nome_completo?.charAt(0)?.toUpperCase() || 
                           currentUser?.email?.charAt(0)?.toUpperCase() || 'U';
    } else {
        const img = document.createElement('img');
        img.src = 'imagens/logo.png';
        img.alt = 'OGGI';
        avatar.appendChild(img);
    }
    
    const messageText = document.createElement('div');
    messageText.className = 'message-text';
    if (isHTML) {
        messageText.innerHTML = text;
    } else {
        messageText.textContent = text;
    }
    
    contentWrapper.appendChild(avatar);
    contentWrapper.appendChild(messageText);
    wrapper.appendChild(contentWrapper);
    
    if (messagesContainer) {
        messagesContainer.appendChild(wrapper);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    return wrapper;
}

// --- SISTEMA DE CHAT COM SUPABASE ---
async function startNewChat() {
    console.log('🚀 Iniciando nova conversa...');
    
    // ✅ VALIDAÇÃO: Verifica se usuário está autenticado
    if (!currentUser || !currentUser.id) {
        console.error('❌ Não é possível criar conversa: usuário não autenticado');
        alert('Erro: Você precisa estar logado para criar uma conversa.\n\nPor favor, faça login novamente.');
        window.location.href = '/login.html';
        return;
    }
    
    try {
        // Cria nova sala no Supabase
        const newRoom = await createRoomInSupabase();
        
        if (!newRoom) {
            console.error('❌ Falha ao criar sala no Supabase');
            
            // Mensagem de erro mais detalhada
            const errorMsg = 'Erro ao criar nova conversa.\n\n' +
                           'Possíveis causas:\n' +
                           '• Problema de conexão com o Supabase\n' +
                           '• Permissões (RLS) não configuradas\n' +
                           '• Tabela "salas" não existe\n\n' +
                           'Verifique o console (F12) para mais detalhes.';
            
            alert(errorMsg);
            return;
        }

        const session = {
            id: newRoom.id,
            title: newRoom.nome,
            created_at: newRoom.created_at,
            messages: []
        };
        
        // Adiciona nova sessão
        chatSessions.unshift(session);
        setActiveSession(newRoom.id);
        
        renderActiveChats();
        renderChatHistory();
        renderActiveChat();
        
        if (messageInput) messageInput.focus();
        if (window.innerWidth <= 768 && sidebar) {
            sidebar.classList.remove('active');
        }
        
        console.log('✅ Nova conversa criada com ID:', newRoom.id);
        
    } catch (error) {
        console.error('💥 Erro inesperado ao iniciar nova conversa:', error);
        alert('Erro inesperado ao criar conversa. Verifique sua conexão e tente novamente.');
    }
}

function setActiveSession(sessionId) {
    currentSessionId = sessionId;
}

function getActiveSession() {
    if (currentSessionId === null && chatSessions.length > 0) {
        currentSessionId = chatSessions[0].id;
    }
    return chatSessions.find(session => session.id === currentSessionId);
}

// --- SISTEMA DE ABAS ATIVAS ---
function renderActiveChats() {
    if (!activeChatsList) {
        console.warn('Elemento #chatTabs não encontrado');
        return;
    }
    
    // Pega as 5 conversas mais recentes para as abas
    const recentSessions = [...chatSessions]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 5);
    
    const activeChatsHtml = recentSessions.map(session => {
        const isActive = session.id === currentSessionId;
        const safeTitle = (session.title || 'Nova conversa').replace(/</g, "&lt;").replace(/>/g, "&gt;");
        
        return `
            <div class="active-chat-tab ${isActive ? 'active' : ''}" data-session-id="${session.id}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <span class="active-chat-tab-title">${safeTitle}</span>
                <button class="active-chat-tab-close" title="Fechar" data-session-id="${session.id}">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                </button>
                <button class="active-chat-tab-delete" title="Deletar" data-session-id="${session.id}">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
        `;
    }).join('');
    
    activeChatsList.innerHTML = activeChatsHtml;
    
    // Event listeners para abas
    document.querySelectorAll('.active-chat-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const sessionId = parseInt(this.getAttribute('data-session-id'));
            if (sessionId !== currentSessionId) {
                setActiveSession(sessionId);
                renderActiveChats();
                renderActiveChat();
                if (window.innerWidth <= 768 && sidebar) {
                    sidebar.classList.remove('active');
                }
            }
        });
    });
    
    // Event listeners para fechar abas
    document.querySelectorAll('.active-chat-tab-close').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const sessionId = parseInt(this.getAttribute('data-session-id'));
            
            renderActiveChats();
            renderChatHistory();
            
            if (currentSessionId === sessionId && chatSessions.length > 0) {
                const otherSession = chatSessions.find(s => s.id !== sessionId);
                if (otherSession) {
                    setActiveSession(otherSession.id);
                    renderActiveChat();
                } else {
                    startNewChat();
                }
            }
        });
    });
    
    // Event listeners para deletar abas
    document.querySelectorAll('.active-chat-tab-delete').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const sessionId = parseInt(this.getAttribute('data-session-id'));
            deleteSession(sessionId, e);
        });
    });
}

// --- SISTEMA DE HISTÓRICO ---
function renderChatHistory() {
    const sortedSessions = [...chatSessions].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    const historyHtml = sortedSessions.map(session => {
        const isActive = session.id === currentSessionId;
        const safeTitle = (session.title || 'Nova conversa').replace(/</g, "&lt;").replace(/>/g, "&gt;");
        
        return `
            <div class="history-item ${isActive ? 'active' : ''}" data-session-id="${session.id}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <span>${safeTitle}</span>
                <button class="history-item-delete" title="Deletar" data-session-id="${session.id}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
        `;
    }).join('');
    
    if (chatHistory) {
        const existingTitle = chatHistory.querySelector('h3');
        chatHistory.innerHTML = '';
        if (existingTitle) chatHistory.appendChild(existingTitle);
        chatHistory.innerHTML += historyHtml;
    }
    
    // Event listeners para histórico
    document.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', function() {
            const sessionId = parseInt(this.getAttribute('data-session-id'));
            if (sessionId !== currentSessionId) {
                setActiveSession(sessionId);
                renderActiveChats();
                renderActiveChat();
                renderChatHistory();
                if (window.innerWidth <= 768 && sidebar) {
                    sidebar.classList.remove('active');
                }
            }
        });
    });
    
    // Event listeners para deletar do histórico
    document.querySelectorAll('.history-item-delete').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const sessionId = parseInt(this.getAttribute('data-session-id'));
            deleteSession(sessionId, e);
        });
    });
}

// --- SISTEMA DE EXCLUSÃO ---
async function deleteSession(sessionId, e) {
    if (e) e.stopPropagation();
    
    const sessionToDelete = chatSessions.find(s => s.id === sessionId);
    if (!sessionToDelete) return;
    
    sessionIdToDelete = sessionId;
    
    if (deleteModalMessage) {
        const safeTitle = (sessionToDelete.title || 'esta conversa').replace(/</g, "&lt;").replace(/>/g, "&gt;");
        deleteModalMessage.textContent = `Tem certeza que deseja apagar "${safeTitle}" para sempre? Esta ação não pode ser desfeita.`;
    }
    
    openDeleteModal();
}

async function confirmAndDelete() {
    if (sessionIdToDelete === null) return;
    
    const sessionId = sessionIdToDelete;
    sessionIdToDelete = null;
    
    console.log(`🗑️ Deletando sala ID: ${sessionId}`);
    
    // Deleta do Supabase
    const success = await deleteRoomFromSupabase(sessionId);
    
    if (success) {
        // Remove da memória local
        chatSessions = chatSessions.filter(session => session.id !== sessionId);
        
        // Se deletou a sessão ativa, ativa outra ou cria nova
        if (currentSessionId === sessionId) {
            if (chatSessions.length > 0) {
                setActiveSession(chatSessions[0].id);
                renderActiveChat();
            } else {
                closeDeleteModal();
                await startNewChat();
                return;
            }
        }
        
        renderActiveChats();
        renderChatHistory();
        closeDeleteModal();
    } else {
        alert('Erro ao deletar conversa');
    }
}

// --- MODAL ---
function openDeleteModal() {
    if (deleteModalOverlay) deleteModalOverlay.classList.remove('hidden');
    if (confirmDeleteModal) confirmDeleteModal.classList.remove('hidden');
}

function closeDeleteModal() {
    if (deleteModalOverlay) deleteModalOverlay.classList.add('hidden');
    if (confirmDeleteModal) confirmDeleteModal.classList.add('hidden');
    sessionIdToDelete = null;
}

// --- RENDERIZAÇÃO DO CHAT ATIVO ---
function renderActiveChat() {
    if (!messagesContainer) return;
    
    const activeSession = getActiveSession();
    
    if (!activeSession) {
        messagesContainer.innerHTML = `<div class="welcome-message"><p>Nenhuma conversa ativa. Comece uma nova!</p></div>`;
        if (messageInput) {
            messageInput.value = '';
            messageInput.style.height = 'auto';
        }
        return;
    }
    
    messagesContainer.innerHTML = '';
    
    if (!activeSession.messages || activeSession.messages.length === 0) {
        messagesContainer.innerHTML = `<div class="welcome-message"><p>Como posso ajudar você hoje?</p></div>`;
    } else {
        activeSession.messages.forEach(msg => {
            if (msg.sender === 'user') {
                addMessageToContainer(msg.content, 'user', false);
            } else if (msg.sender === 'bot') {
                addMessageToContainer(msg.content_formatted || msg.content, 'bot', true);
            }
        });
    }
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// --- SISTEMA DE MENSAGENS ---
async function sendMessage() {
    if (!messageInput || !messagesContainer) return;
    
    const message = messageInput.value.trim();
    if (!message) return;
    
    // ✅ IMPEDE ENVIO MÚLTIPLO DURANTE PROCESSAMENTO
    if (isProcessing) {
        console.log('⚠️ Aguarde a resposta anterior antes de enviar nova mensagem');
        return;
    }
    
    let activeSession = getActiveSession();
    if (!activeSession) {
        console.log('⚠️ Nenhuma sessão ativa, criando nova...');
        await startNewChat();
        activeSession = getActiveSession();
        if (!activeSession) {
            console.error('❌ Falha ao criar sessão ativa');
            return;
        }
    }

    // Remove mensagem de boas-vindas
    const welcomeMsg = messagesContainer.querySelector('.welcome-message');
    if (welcomeMsg) welcomeMsg.remove();
    
    // ✅ MARCA COMO PROCESSANDO E DESABILITA APENAS O BOTÃO
    isProcessing = true;
    if (sendButton) sendButton.disabled = true;
    
    // Adiciona mensagem do usuário na interface
    addMessageToContainer(message, 'user');
    
    // Salva mensagem do usuário no Supabase
    const userMessage = await saveMessageToSupabase(activeSession.id, 'user', message, null);
    if (!userMessage) {
        console.error('❌ Falha ao salvar mensagem do usuário');
    }
    
    // ✅ LIMPA O INPUT MAS NÃO DESABILITA (usuário pode continuar digitando)
    const currentMessage = message;
    messageInput.value = '';
    messageInput.style.height = 'auto';
    
    // Indicador de digitação
    if (currentTypingIndicator) currentTypingIndicator.remove();
    currentTypingIndicator = addTypingIndicator();
    
    try {
        // Prepara histórico para a IA
        const conversationHistory = activeSession.messages ? activeSession.messages.map(msg => ({
            user: msg.sender === 'user' ? msg.content : null,
            bot: msg.sender === 'bot' ? msg.content : null,
            timestamp: msg.created_at
        })).filter(msg => msg.user || msg.bot) : [];

        const payload = {
            message: currentMessage,
            timestamp: new Date().toISOString(),
            conversationHistory: conversationHistory,
            sessionId: activeSession.id,
            userId: currentUser.id
        };
        
        console.log('📤 Enviando para IA...');
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            throw new Error(`Erro ${response.status}`);
        }
        
        const data = await response.json();
        
        // Remove indicador
        if (currentTypingIndicator) {
            currentTypingIndicator.remove();
            currentTypingIndicator = null;
        }
        
        // Processa resposta
        let botResponse = data.response || data.message || data.text || data.output || 
                         'Desculpe, não consegui processar sua mensagem.';
        
        if (Array.isArray(botResponse) && botResponse.length > 0) {
            if (typeof botResponse[0] === 'object' && botResponse[0].output) {
                botResponse = botResponse[0].output;
            } else if (typeof botResponse[0] === 'string') {
                botResponse = botResponse[0];
            }
        }
        
        if (typeof botResponse === 'object' && botResponse.output) {
            botResponse = botResponse.output;
        }
        
        const formattedResponse = formatBotMessage(botResponse);
        
        // Adiciona mensagem do bot na interface
        addMessageToContainer(formattedResponse, 'bot', true);
        
        // Salva mensagem do bot no Supabase
        await saveMessageToSupabase(activeSession.id, 'bot', botResponse, formattedResponse);
        
        // Atualiza sessão local
        if (!activeSession.messages) activeSession.messages = [];
        
        // Adiciona ambas as mensagens (usuário e bot)
        activeSession.messages.push(
            { 
                sender: 'user', 
                content: currentMessage, 
                content_formatted: null, 
                created_at: new Date().toISOString() 
            },
            { 
                sender: 'bot', 
                content: botResponse, 
                content_formatted: formattedResponse, 
                created_at: new Date().toISOString() 
            }
        );
        
        // Atualiza título da sala
        const newTitle = currentMessage.substring(0, 30) + (currentMessage.length > 30 ? '...' : '');
        activeSession.title = newTitle;
        
        // Atualiza no Supabase
        const updateSuccess = await updateRoomName(activeSession.id, newTitle);
        if (!updateSuccess) {
            console.error('❌ Falha ao atualizar nome da sala');
        }
        
        renderActiveChats();
        renderChatHistory();
        
        console.log('✅ Mensagem processada com sucesso');

    } catch (error) {
        console.error('💥 Erro ao enviar mensagem:', error);
        
        if (currentTypingIndicator) {
            currentTypingIndicator.remove();
            currentTypingIndicator = null;
        }
        
        addMessageToContainer('Desculpe, ocorreu um erro. Tente novamente.', 'bot', false);
    } finally {
        // ✅ LIBERA O BOTÃO APÓS PROCESSAR
        isProcessing = false;
        if (sendButton) sendButton.disabled = false;
        messageInput.focus();
    }
}

// --- SISTEMA DE PERFIL ---
async function loadUserProfile() {
    if (typeof supabase === 'undefined') {
        console.error("❌ Supabase client não iniciado.");
        return;
    }
    
    try {
        console.log('👤 Carregando perfil do usuário...');
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        
        if (user) {
            currentUser = user;
            const email = user.email;
            const name = user.user_metadata?.nome_completo || email.split('@')[0];
            const initial = name.charAt(0).toUpperCase();
            
            if (profileAvatar) profileAvatar.textContent = initial;
            if (profileName) profileName.textContent = name;
            if (profileEmail) profileEmail.textContent = email;
            
            console.log('✅ Usuário carregado:', name, email);
        } else {
            console.warn('⚠️ getUser() retornou nulo');
        }
    } catch (error) {
        console.error("💥 Erro ao carregar perfil:", error);
    }
}

// --- CARREGAR DADOS DO SUPABASE ---
async function loadChatSessionsFromSupabase() {
    if (!currentUser) {
        console.error('❌ Usuário não autenticado');
        return false;
    }
    
    try {
        console.log('🔄 Carregando sessões do Supabase...');
        // Carrega salas do usuário
        const rooms = await loadRoomsFromSupabase();
        
        if (rooms.length === 0) {
            console.log('📭 Nenhuma sala encontrada para o usuário');
            return false;
        }
        
        // Para cada sala, carrega as mensagens
        chatSessions = [];
        for (const room of rooms) {
            const messages = await loadMessagesFromRoom(room.id);
            
            // Converte mensagens para o formato local
            const sessionMessages = [];
            for (const msg of messages) {
                sessionMessages.push({
                    sender: msg.sender,
                    content: msg.content,
                    content_formatted: msg.content_formatted,
                    created_at: msg.created_at
                });
            }
            
            chatSessions.push({
                id: room.id,
                title: room.nome,
                created_at: room.created_at,
                messages: sessionMessages
            });
        }
        
        // Ordena por data de criação (mais recente primeiro)
        chatSessions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        console.log(`✅ ${chatSessions.length} sessões carregadas do Supabase`);
        return chatSessions.length > 0;
    } catch (error) {
        console.error('💥 Erro ao carregar sessões do Supabase:', error);
        return false;
    }
}

// --- SIDEBAR ---
function toggleSidebarCollapse() {
    document.body.classList.toggle('sidebar-collapsed');
    localStorage.setItem('sidebarCollapsed', document.body.classList.contains('sidebar-collapsed'));
    
    if (collapseSidebarBtn) {
        collapseSidebarBtn.title = document.body.classList.contains('sidebar-collapsed') ? 
            "Expandir menu" : "Recolher menu";
    }
}

function loadSidebarState() {
    const savedState = localStorage.getItem('sidebarCollapsed');
    if (savedState === 'true' && window.innerWidth > 768) {
        document.body.classList.add('sidebar-collapsed');
        if (collapseSidebarBtn) collapseSidebarBtn.title = "Expandir menu";
    }
}

// --- INICIALIZAÇÃO ---
async function initializeApp() {
    console.log('🚀 Inicializando aplicação...');
    
    // Carrega configurações
    loadTheme();
    loadSidebarState();
    
    // Event listeners básicos
    if (sendButton) sendButton.addEventListener('click', sendMessage);
    
    if (messageInput) {
        messageInput.addEventListener('keydown', (e) => {
            // ✅ PERMITE ENTER SÓ SE NÃO ESTIVER PROCESSANDO
            if (e.key === 'Enter' && !e.shiftKey && !isProcessing) {
                e.preventDefault();
                sendMessage();
            }
        });
        messageInput.addEventListener('input', autoResize);
    }
    
    if (newChatBtn) newChatBtn.addEventListener('click', startNewChat);
    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
    
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            if (sidebar) sidebar.classList.toggle('active');
        });
    }
    
    if (collapseSidebarBtn) {
        collapseSidebarBtn.addEventListener('click', toggleSidebarCollapse);
    }
    
    // Modal events
    if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', confirmAndDelete);
    if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', closeDeleteModal);
    if (closeDeleteModalBtn) closeDeleteModalBtn.addEventListener('click', closeDeleteModal);
    
    if (deleteModalOverlay) {
        deleteModalOverlay.addEventListener('click', (e) => {
            if (e.target === deleteModalOverlay) closeDeleteModal();
        });
    }
    
    // Perfil
    if (userProfile) {
        userProfile.addEventListener('click', (e) => {
            e.stopPropagation();
            userProfile.classList.toggle('active');
        });
    }
    
    if (profileLogoutBtn && typeof fazerLogout === 'function') {
        profileLogoutBtn.addEventListener('click', fazerLogout);
    }
    
    // Carrega perfil do usuário
    await loadUserProfile();
    
    if (currentUser) {
        console.log('👤 Usuário autenticado, carregando dados...');
        
        try {
            const hasSessions = await loadChatSessionsFromSupabase();
            
            if (!hasSessions) {
                console.log('📝 Criando primeira conversa para usuário novo...');
                await startNewChat();
            } else {
                console.log('✅ Dados carregados, configurando interface...');
                // Define a primeira sessão como ativa
                if (chatSessions.length > 0) {
                    setActiveSession(chatSessions[0].id);
                }
                
                renderActiveChats();
                renderChatHistory();
                renderActiveChat();
            }
            
            console.log('🎉 Aplicação inicializada com sucesso!');
            
        } catch (error) {
            console.error('💥 Erro durante inicialização:', error);
            // Fallback: cria uma conversa mesmo com erro
            await startNewChat();
        }
        
    } else {
        console.error('❌ Usuário não autenticado. Redirecionando para login...');
        // window.location.href = '/login.html';
    }
    
    if (messageInput) messageInput.focus();
}

// Inicia a aplicação
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM carregado, iniciando app...');
    initializeApp();
});

console.log('✅ Script.js carregado com sucesso.');