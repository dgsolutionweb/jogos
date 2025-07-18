// Variáveis globais
let produtos = JSON.parse(localStorage.getItem('produtos')) || [];
let carrinho = [];
let vendas = JSON.parse(localStorage.getItem('vendas')) || [];
let scannerAtivo = false;
let produtoAtual = null;

// Sistema de dinheiro
let caixa = JSON.parse(localStorage.getItem('caixa')) || {
    notas100: 0, notas50: 0, notas20: 0, notas10: 0, notas5: 0, notas2: 0,
    moedas1: 0, moedas050: 0, moedas025: 0, moedas010: 0, moedas005: 0, moedas001: 0
};
let valorPagar = 0;
let valorRecebido = 0;

// Sistema de cartões
let cartoes = JSON.parse(localStorage.getItem('cartoes')) || [];
let transacoesCartao = JSON.parse(localStorage.getItem('transacoesCartao')) || [];
let cartaoAtual = null;

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    // Registrar Service Worker para PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('Service Worker registrado:', registration);
                
                // Verificar atualizações
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            mostrarNotificacao('Nova versão disponível! Recarregue a página.', 'info');
                        }
                    });
                });
            })
            .catch(error => console.log('Erro ao registrar Service Worker:', error));
    }
    
    // Detectar se é PWA instalado
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
        document.body.classList.add('pwa-installed');
        console.log('App rodando como PWA');
    }
    
    // Prompt de instalação PWA
    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        mostrarBotaoInstalar();
    });
    
    // Carregar dados salvos
    carregarDadosSalvos();
    
    // Inicializar interface
    atualizarContadores();
    atualizarListaProdutos();
    atualizarRelatorioVendas();
    atualizarCaixa();
    atualizarListaCartoes();
    atualizarHistoricoTransacoes();
    
    // Event listeners
    document.getElementById('formProduto').addEventListener('submit', cadastrarProduto);
    document.getElementById('buscarProduto').addEventListener('input', filtrarProdutos);
    document.getElementById('filtroCategoria').addEventListener('change', filtrarProdutos);
    document.getElementById('formCartao').addEventListener('submit', criarCartao);
    
    // Auto-save a cada 30 segundos
    setInterval(salvarTodosDados, 30000);
    
    // Salvar dados antes de fechar
    window.addEventListener('beforeunload', salvarTodosDados);
    
    // Detectar mudanças de conectividade
    window.addEventListener('online', () => {
        mostrarNotificacao('Conectado à internet!', 'success');
        sincronizarDados();
    });
    
    window.addEventListener('offline', () => {
        mostrarNotificacao('Modo offline ativado', 'warning');
    });
});

// Navegação entre seções
function showSection(sectionName) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.add('hidden');
    });
    document.getElementById(sectionName).classList.remove('hidden');
    
    // Atualizar botões de navegação
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('ring-2', 'ring-white');
    });
    event.target.classList.add('ring-2', 'ring-white');
}

// Cadastro de produtos
function cadastrarProduto(e) {
    e.preventDefault();
    
    const nome = document.getElementById('nomeProduto').value;
    const preco = parseFloat(document.getElementById('precoProduto').value);
    const codigo = document.getElementById('codigoProduto').value || gerarCodigoAleatorio();
    const categoria = document.getElementById('categoriaProduto').value;
    
    // Verificar se o código já existe
    if (produtos.find(p => p.codigo === codigo)) {
        alert('Este código de barras já está cadastrado!');
        return;
    }
    
    const produto = {
        id: Date.now(),
        nome,
        preco,
        codigo,
        categoria,
        dataCadastro: new Date().toLocaleDateString()
    };
    
    produtos.push(produto);
    localStorage.setItem('produtos', JSON.stringify(produtos));
    
    // Limpar formulário
    document.getElementById('formProduto').reset();
    
    // Feedback visual
    mostrarNotificacao('Produto cadastrado com sucesso!', 'success');
    
    atualizarContadores();
    atualizarListaProdutos();
}

function gerarCodigoAleatorio() {
    const codigo = Math.floor(Math.random() * 9000000000000) + 1000000000000;
    document.getElementById('codigoProduto').value = codigo.toString();
    return codigo.toString();
}

// Scanner de código de barras
function iniciarScanner() {
    if (scannerAtivo) return;
    
    document.getElementById('scanner-overlay').style.display = 'none';
    scannerAtivo = true;
    
    Quagga.init({
        inputStream: {
            name: "Live",
            type: "LiveStream",
            target: document.querySelector('#video'),
            constraints: {
                width: 640,
                height: 480,
                facingMode: "environment"
            }
        },
        decoder: {
            readers: [
                "code_128_reader",
                "ean_reader",
                "ean_8_reader",
                "code_39_reader"
            ]
        }
    }, function(err) {
        if (err) {
            console.log(err);
            alert('Erro ao iniciar a câmera. Verifique as permissões.');
            return;
        }
        Quagga.start();
    });
    
    Quagga.onDetected(function(data) {
        const codigo = data.codeResult.code;
        document.getElementById('codigoLido').textContent = codigo;
        
        // Buscar produto
        const produto = produtos.find(p => p.codigo === codigo);
        
        if (produto) {
            produtoAtual = produto;
            document.getElementById('produtoEncontrado').classList.remove('hidden');
            document.getElementById('produtoNaoEncontrado').classList.add('hidden');
            document.getElementById('infoProduto').innerHTML = `
                <div class="font-semibold text-lg">${produto.nome}</div>
                <div class="text-green-600 font-bold text-xl">R$ ${produto.preco.toFixed(2)}</div>
                <div class="text-gray-600">${getCategoriaIcon(produto.categoria)} ${produto.categoria}</div>
            `;
        } else {
            produtoAtual = null;
            document.getElementById('produtoEncontrado').classList.add('hidden');
            document.getElementById('produtoNaoEncontrado').classList.remove('hidden');
        }
        
        // Som de beep
        playBeep();
    });
}

function pararScanner() {
    if (!scannerAtivo) return;
    
    Quagga.stop();
    scannerAtivo = false;
    document.getElementById('scanner-overlay').style.display = 'flex';
}

function alternarCamera() {
    // Implementação básica para trocar câmera
    pararScanner();
    setTimeout(() => {
        iniciarScanner();
    }, 1000);
}

function playBeep() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'square';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
}

// Gerenciamento do carrinho
function adicionarAoCarrinho() {
    if (!produtoAtual) return;
    
    const itemExistente = carrinho.find(item => item.id === produtoAtual.id);
    
    if (itemExistente) {
        itemExistente.quantidade++;
    } else {
        carrinho.push({
            ...produtoAtual,
            quantidade: 1
        });
    }
    
    atualizarCarrinho();
    mostrarNotificacao('Produto adicionado ao carrinho!', 'success');
}

function removerDoCarrinho(id) {
    carrinho = carrinho.filter(item => item.id !== id);
    atualizarCarrinho();
}

function alterarQuantidade(id, novaQuantidade) {
    if (novaQuantidade <= 0) {
        removerDoCarrinho(id);
        return;
    }
    
    const item = carrinho.find(item => item.id === id);
    if (item) {
        item.quantidade = novaQuantidade;
        atualizarCarrinho();
    }
}

function atualizarCarrinho() {
    const container = document.getElementById('itensCarrinho');
    
    if (carrinho.length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                <i class="fas fa-shopping-cart text-4xl mb-2"></i>
                <p>Carrinho vazio</p>
            </div>
        `;
    } else {
        container.innerHTML = carrinho.map(item => `
            <div class="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                <div class="flex-1">
                    <div class="font-semibold">${item.nome}</div>
                    <div class="text-green-600 font-bold">R$ ${item.preco.toFixed(2)}</div>
                </div>
                <div class="flex items-center space-x-2">
                    <button onclick="alterarQuantidade(${item.id}, ${item.quantidade - 1})" class="bg-red-500 text-white w-8 h-8 rounded-full hover:bg-red-600">-</button>
                    <span class="w-8 text-center font-semibold">${item.quantidade}</span>
                    <button onclick="alterarQuantidade(${item.id}, ${item.quantidade + 1})" class="bg-green-500 text-white w-8 h-8 rounded-full hover:bg-green-600">+</button>
                    <button onclick="removerDoCarrinho(${item.id})" class="bg-gray-500 text-white px-2 py-1 rounded hover:bg-gray-600 ml-2">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    // Atualizar total
    const total = carrinho.reduce((sum, item) => sum + (item.preco * item.quantidade), 0);
    document.getElementById('totalCarrinho').textContent = total.toFixed(2);
}

function limparCarrinho() {
    carrinho = [];
    atualizarCarrinho();
    mostrarNotificacao('Carrinho limpo!', 'info');
}

function finalizarCompra() {
    if (carrinho.length === 0) {
        alert('Carrinho vazio!');
        return;
    }
    
    const total = carrinho.reduce((sum, item) => sum + (item.preco * item.quantidade), 0);
    const venda = {
        id: Date.now(),
        itens: [...carrinho],
        total: total,
        data: new Date().toLocaleString(),
        quantidadeItens: carrinho.reduce((sum, item) => sum + item.quantidade, 0)
    };
    
    vendas.push(venda);
    localStorage.setItem('vendas', JSON.stringify(vendas));
    
    // Mostrar modal de sucesso
    document.getElementById('totalFinal').textContent = total.toFixed(2);
    document.getElementById('modalSucesso').classList.remove('hidden');
    document.getElementById('modalSucesso').classList.add('flex');
    
    // Limpar carrinho
    carrinho = [];
    atualizarCarrinho();
    atualizarRelatorioVendas();
    atualizarContadores();
}

function fecharModal() {
    document.getElementById('modalSucesso').classList.add('hidden');
    document.getElementById('modalSucesso').classList.remove('flex');
}

// Gerenciamento de produtos
function atualizarListaProdutos() {
    const container = document.getElementById('listaProdutos');
    const busca = document.getElementById('buscarProduto')?.value.toLowerCase() || '';
    const categoria = document.getElementById('filtroCategoria')?.value || '';
    
    let produtosFiltrados = produtos.filter(produto => {
        const matchBusca = produto.nome.toLowerCase().includes(busca) || 
                         produto.codigo.includes(busca);
        const matchCategoria = !categoria || produto.categoria === categoria;
        return matchBusca && matchCategoria;
    });
    
    if (produtosFiltrados.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center text-gray-500 py-8">
                <i class="fas fa-box-open text-4xl mb-2"></i>
                <p>Nenhum produto encontrado</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = produtosFiltrados.map(produto => `
        <div class="bg-gradient-to-br from-white to-gray-50 border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow">
            <div class="flex justify-between items-start mb-2">
                <h3 class="font-semibold text-gray-800 flex-1">${produto.nome}</h3>
                <button onclick="excluirProduto(${produto.id})" class="text-red-500 hover:text-red-700">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="text-2xl font-bold text-green-600 mb-2">R$ ${produto.preco.toFixed(2)}</div>
            <div class="text-sm text-gray-600 mb-2">
                ${getCategoriaIcon(produto.categoria)} ${produto.categoria}
            </div>
            <div class="text-xs text-gray-500 mb-3">
                Código: ${produto.codigo}
            </div>
            <button onclick="adicionarProdutoAoCarrinho(${produto.id})" class="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg transition-colors">
                <i class="fas fa-cart-plus mr-2"></i>Adicionar ao Carrinho
            </button>
        </div>
    `).join('');
}

function filtrarProdutos() {
    atualizarListaProdutos();
}

function excluirProduto(id) {
    if (confirm('Tem certeza que deseja excluir este produto?')) {
        produtos = produtos.filter(p => p.id !== id);
        localStorage.setItem('produtos', JSON.stringify(produtos));
        atualizarListaProdutos();
        atualizarContadores();
        mostrarNotificacao('Produto excluído!', 'info');
    }
}

function adicionarProdutoAoCarrinho(id) {
    const produto = produtos.find(p => p.id === id);
    if (!produto) return;
    
    const itemExistente = carrinho.find(item => item.id === id);
    
    if (itemExistente) {
        itemExistente.quantidade++;
    } else {
        carrinho.push({
            ...produto,
            quantidade: 1
        });
    }
    
    atualizarCarrinho();
    mostrarNotificacao('Produto adicionado ao carrinho!', 'success');
}

// Relatórios e estatísticas
function atualizarRelatorioVendas() {
    const vendasHoje = vendas.filter(venda => {
        const hoje = new Date().toDateString();
        const dataVenda = new Date(venda.data).toDateString();
        return hoje === dataVenda;
    });
    
    const totalVendasHoje = vendasHoje.reduce((sum, venda) => sum + venda.total, 0);
    const produtosVendidosHoje = vendasHoje.reduce((sum, venda) => sum + venda.quantidadeItens, 0);
    
    document.getElementById('vendasHoje').textContent = totalVendasHoje.toFixed(2);
    document.getElementById('produtosVendidos').textContent = produtosVendidosHoje;
    document.getElementById('totalTransacoes').textContent = vendasHoje.length;
    
    // Últimas vendas
    const ultimasVendas = vendas.slice(-5).reverse();
    const container = document.getElementById('ultimasVendas');
    
    if (ultimasVendas.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-4">Nenhuma venda realizada</p>';
    } else {
        container.innerHTML = ultimasVendas.map(venda => `
            <div class="bg-gray-50 p-3 rounded-lg">
                <div class="flex justify-between items-center">
                    <span class="font-semibold">R$ ${venda.total.toFixed(2)}</span>
                    <span class="text-sm text-gray-600">${new Date(venda.data).toLocaleString()}</span>
                </div>
                <div class="text-sm text-gray-600">${venda.quantidadeItens} itens</div>
            </div>
        `).join('');
    }
}

function atualizarContadores() {
    const totalVendas = vendas.reduce((sum, venda) => sum + venda.total, 0);
    document.getElementById('totalVendas').textContent = totalVendas.toFixed(2);
    document.getElementById('totalProdutos').textContent = produtos.length;
}

// Impressão de etiquetas
function imprimirEtiquetas() {
    if (produtos.length === 0) {
        alert('Nenhum produto cadastrado para imprimir!');
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Configurações da página
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const etiquetaWidth = 85;
    const etiquetaHeight = 50;
    const cols = 2;
    const rows = 5;
    
    let currentPage = 0;
    let currentRow = 0;
    let currentCol = 0;
    
    // Título da página
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('🛒 ETIQUETAS DE PRODUTOS - SUPER MERCADO INTERATIVO', pageWidth / 2, 15, { align: 'center' });
    
    produtos.forEach((produto, index) => {
        // Verificar se precisa de nova página
        if (currentRow >= rows) {
            doc.addPage();
            currentPage++;
            currentRow = 0;
            currentCol = 0;
            
            // Título da nova página
            doc.setFontSize(16);
            doc.setFont(undefined, 'bold');
            doc.text('🛒 ETIQUETAS DE PRODUTOS - SUPER MERCADO INTERATIVO', pageWidth / 2, 15, { align: 'center' });
        }
        
        // Calcular posição da etiqueta
        const x = margin + (currentCol * (etiquetaWidth + 5));
        const y = 25 + (currentRow * (etiquetaHeight + 5));
        
        // Desenhar borda da etiqueta
        doc.setDrawColor(0);
        doc.setLineWidth(0.5);
        doc.rect(x, y, etiquetaWidth, etiquetaHeight);
        
        // Nome do produto
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        const nomeLinhas = doc.splitTextToSize(produto.nome, etiquetaWidth - 10);
        doc.text(nomeLinhas, x + 5, y + 10);
        
        // Preço
        doc.setFontSize(18);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(0, 150, 0);
        doc.text(`R$ ${produto.preco.toFixed(2)}`, x + 5, y + 25);
        
        // Código de barras (simulado com texto)
        doc.setFontSize(8);
        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, 'normal');
        doc.text(`Código: ${produto.codigo}`, x + 5, y + 35);
        
        // Categoria
        doc.setFontSize(8);
        doc.text(`${getCategoriaIcon(produto.categoria)} ${produto.categoria}`, x + 5, y + 42);
        
        // Código de barras visual (linhas simples)
        doc.setLineWidth(0.5);
        for (let i = 0; i < 20; i++) {
            const lineX = x + 45 + (i * 1.5);
            const lineHeight = (i % 3 === 0) ? 8 : 6;
            doc.line(lineX, y + 30, lineX, y + 30 + lineHeight);
        }
        
        // Avançar para próxima posição
        currentCol++;
        if (currentCol >= cols) {
            currentCol = 0;
            currentRow++;
        }
    });
    
    // Adicionar instruções na última página
    const finalY = 25 + (Math.ceil(produtos.length / cols) * (etiquetaHeight + 5)) + 20;
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('📋 INSTRUÇÕES:', margin, finalY);
    doc.text('1. Recorte as etiquetas seguindo as linhas', margin, finalY + 8);
    doc.text('2. Cole nas embalagens dos produtos', margin, finalY + 16);
    doc.text('3. Use o scanner para ler os códigos de barras', margin, finalY + 24);
    doc.text('4. Divirta-se jogando mercado! 🎮', margin, finalY + 32);
    
    // Salvar PDF
    doc.save('etiquetas-produtos.pdf');
    mostrarNotificacao('Etiquetas geradas com sucesso!', 'success');
}

// Funções auxiliares
function getCategoriaIcon(categoria) {
    const icons = {
        'bebidas': '🥤',
        'alimentos': '🍞',
        'limpeza': '🧽',
        'higiene': '🧴',
        'doces': '🍭',
        'outros': '📦'
    };
    return icons[categoria] || '📦';
}

function mostrarNotificacao(mensagem, tipo = 'info') {
    // Criar elemento de notificação
    const notificacao = document.createElement('div');
    notificacao.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transform transition-all duration-300 translate-x-full`;
    
    // Definir cores baseadas no tipo
    const cores = {
        'success': 'bg-green-500 text-white',
        'error': 'bg-red-500 text-white',
        'info': 'bg-blue-500 text-white',
        'warning': 'bg-yellow-500 text-black'
    };
    
    notificacao.className += ` ${cores[tipo] || cores.info}`;
    notificacao.innerHTML = `
        <div class="flex items-center">
            <span class="mr-2">${mensagem}</span>
            <button onclick="this.parentElement.parentElement.remove()" class="ml-2 font-bold">×</button>
        </div>
    `;
    
    document.body.appendChild(notificacao);
    
    // Animar entrada
    setTimeout(() => {
        notificacao.classList.remove('translate-x-full');
    }, 100);
    
    // Remover automaticamente após 3 segundos
    setTimeout(() => {
        notificacao.classList.add('translate-x-full');
        setTimeout(() => {
            if (notificacao.parentElement) {
                notificacao.remove();
            }
        }, 300);
    }, 3000);
}

// Inicializar com alguns produtos de exemplo
if (produtos.length === 0) {
    const produtosExemplo = [
        { id: 1, nome: 'Coca-Cola 350ml', preco: 4.50, codigo: '7894900011517', categoria: 'bebidas', dataCadastro: new Date().toLocaleDateString() },
        { id: 2, nome: 'Pão de Açúcar', preco: 6.90, codigo: '7891234567890', categoria: 'alimentos', dataCadastro: new Date().toLocaleDateString() },
        { id: 3, nome: 'Detergente Ypê', preco: 2.99, codigo: '7896098765432', categoria: 'limpeza', dataCadastro: new Date().toLocaleDateString() },
        { id: 4, nome: 'Shampoo Seda', preco: 12.90, codigo: '7891098765432', categoria: 'higiene', dataCadastro: new Date().toLocaleDateString() },
        { id: 5, nome: 'Chocolate Lacta', preco: 8.50, codigo: '7622210987654', categoria: 'doces', dataCadastro: new Date().toLocaleDateString() }
    ];
    
    produtos = produtosExemplo;
    localStorage.setItem('produtos', JSON.stringify(produtos));
    atualizarContadores();
    atualizarListaProdutos();
}

// ===== SISTEMA DE DINHEIRO =====

// Atualizar display do caixa
function atualizarCaixa() {
    document.getElementById('notas100').textContent = caixa.notas100;
    document.getElementById('notas50').textContent = caixa.notas50;
    document.getElementById('notas20').textContent = caixa.notas20;
    document.getElementById('notas10').textContent = caixa.notas10;
    document.getElementById('notas5').textContent = caixa.notas5;
    document.getElementById('notas2').textContent = caixa.notas2;
    document.getElementById('moedas1').textContent = caixa.moedas1;
    document.getElementById('moedas050').textContent = caixa.moedas050;
    document.getElementById('moedas025').textContent = caixa.moedas025;
    document.getElementById('moedas010').textContent = caixa.moedas010;
    document.getElementById('moedas005').textContent = caixa.moedas005;
    document.getElementById('moedas001').textContent = caixa.moedas001;
    
    const total = calcularTotalCaixa();
    document.getElementById('totalCaixa').textContent = total.toFixed(2);
}

function calcularTotalCaixa() {
    return (caixa.notas100 * 100) + (caixa.notas50 * 50) + (caixa.notas20 * 20) + 
           (caixa.notas10 * 10) + (caixa.notas5 * 5) + (caixa.notas2 * 2) + 
           (caixa.moedas1 * 1) + (caixa.moedas050 * 0.50) + (caixa.moedas025 * 0.25) + 
           (caixa.moedas010 * 0.10) + (caixa.moedas005 * 0.05) + (caixa.moedas001 * 0.01);
}

function adicionarDinheiro(valor) {
    if (valor === 100) caixa.notas100++;
    else if (valor === 50) caixa.notas50++;
    else if (valor === 20) caixa.notas20++;
    else if (valor === 10) caixa.notas10++;
    else if (valor === 5) caixa.notas5++;
    else if (valor === 2) caixa.notas2++;
    else if (valor === 1) caixa.moedas1++;
    else if (valor === 0.50) caixa.moedas050++;
    else if (valor === 0.25) caixa.moedas025++;
    else if (valor === 0.10) caixa.moedas010++;
    else if (valor === 0.05) caixa.moedas005++;
    else if (valor === 0.01) caixa.moedas001++;
    
    localStorage.setItem('caixa', JSON.stringify(caixa));
    atualizarCaixa();
    mostrarNotificacao(`Adicionado R$ ${valor.toFixed(2)} ao caixa!`, 'success');
}

function clientePagou(valor) {
    valorRecebido += valor;
    document.getElementById('valorRecebido').textContent = valorRecebido.toFixed(2);
    
    // Atualizar valor a pagar com o total do carrinho
    const totalCarrinho = carrinho.reduce((sum, item) => sum + (item.preco * item.quantidade), 0);
    valorPagar = totalCarrinho;
    document.getElementById('valorPagar').textContent = valorPagar.toFixed(2);
    
    // Calcular troco
    const troco = valorRecebido - valorPagar;
    document.getElementById('valorTroco').textContent = troco.toFixed(2);
    
    if (troco >= 0) {
        calcularTrocoDetalhado(troco);
    }
}

function calcularTrocoDetalhado(troco) {
    if (troco <= 0) {
        document.getElementById('trocoDetalhado').classList.add('hidden');
        return;
    }
    
    document.getElementById('trocoDetalhado').classList.remove('hidden');
    
    let trocoRestante = Math.round(troco * 100) / 100;
    const breakdown = [];
    
    const valores = [100, 50, 20, 10, 5, 2, 1, 0.50, 0.25, 0.10, 0.05, 0.01];
    const nomes = ['R$ 100,00', 'R$ 50,00', 'R$ 20,00', 'R$ 10,00', 'R$ 5,00', 'R$ 2,00', 
                   'R$ 1,00', 'R$ 0,50', 'R$ 0,25', 'R$ 0,10', 'R$ 0,05', 'R$ 0,01'];
    
    valores.forEach((valor, index) => {
        const quantidade = Math.floor(trocoRestante / valor);
        if (quantidade > 0) {
            breakdown.push(`${quantidade}x ${nomes[index]} = R$ ${(quantidade * valor).toFixed(2)}`);
            trocoRestante = Math.round((trocoRestante - (quantidade * valor)) * 100) / 100;
        }
    });
    
    document.getElementById('trocoBreakdown').innerHTML = breakdown.map(item => 
        `<div class="flex justify-between"><span>${item}</span></div>`
    ).join('');
}

function limparPagamento() {
    valorPagar = 0;
    valorRecebido = 0;
    document.getElementById('valorPagar').textContent = '0,00';
    document.getElementById('valorRecebido').textContent = '0,00';
    document.getElementById('valorTroco').textContent = '0,00';
    document.getElementById('trocoDetalhado').classList.add('hidden');
}

function confirmarPagamentoDinheiro() {
    if (carrinho.length === 0) {
        alert('Carrinho vazio!');
        return;
    }
    
    const total = carrinho.reduce((sum, item) => sum + (item.preco * item.quantidade), 0);
    const troco = valorRecebido - total;
    
    if (valorRecebido < total) {
        alert('Valor recebido insuficiente!');
        return;
    }
    
    // Registrar venda
    const venda = {
        id: Date.now(),
        itens: [...carrinho],
        total: total,
        valorRecebido: valorRecebido,
        troco: troco,
        metodoPagamento: 'dinheiro',
        data: new Date().toLocaleString(),
        quantidadeItens: carrinho.reduce((sum, item) => sum + item.quantidade, 0)
    };
    
    vendas.push(venda);
    localStorage.setItem('vendas', JSON.stringify(vendas));
    
    // Adicionar dinheiro recebido ao caixa
    adicionarDinheiroRecebidoAoCaixa(valorRecebido);
    
    // Mostrar modal de sucesso
    document.getElementById('totalFinal').textContent = total.toFixed(2);
    document.getElementById('modalSucesso').classList.remove('hidden');
    document.getElementById('modalSucesso').classList.add('flex');
    
    // Limpar tudo
    carrinho = [];
    limparPagamento();
    atualizarCarrinho();
    atualizarRelatorioVendas();
    atualizarContadores();
    
    mostrarNotificacao(`Pagamento confirmado! Troco: R$ ${troco.toFixed(2)}`, 'success');
}

function adicionarDinheiroRecebidoAoCaixa(valor) {
    // Lógica simplificada - adiciona o valor recebido ao caixa
    // Em um sistema real, seria mais complexo baseado nas notas/moedas recebidas
    let valorRestante = Math.round(valor * 100) / 100;
    
    while (valorRestante >= 100) { caixa.notas100++; valorRestante -= 100; }
    while (valorRestante >= 50) { caixa.notas50++; valorRestante -= 50; }
    while (valorRestante >= 20) { caixa.notas20++; valorRestante -= 20; }
    while (valorRestante >= 10) { caixa.notas10++; valorRestante -= 10; }
    while (valorRestante >= 5) { caixa.notas5++; valorRestante -= 5; }
    while (valorRestante >= 2) { caixa.notas2++; valorRestante -= 2; }
    while (valorRestante >= 1) { caixa.moedas1++; valorRestante -= 1; }
    while (valorRestante >= 0.50) { caixa.moedas050++; valorRestante -= 0.50; }
    while (valorRestante >= 0.25) { caixa.moedas025++; valorRestante -= 0.25; }
    while (valorRestante >= 0.10) { caixa.moedas010++; valorRestante -= 0.10; }
    while (valorRestante >= 0.05) { caixa.moedas005++; valorRestante -= 0.05; }
    while (valorRestante >= 0.01) { caixa.moedas001++; valorRestante -= 0.01; }
    
    localStorage.setItem('caixa', JSON.stringify(caixa));
    atualizarCaixa();
}

// Imprimir dinheiro para recortar
function imprimirDinheiro() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('💰 DINHEIRO PARA RECORTAR - SUPER MERCADO INTERATIVO', 105, 15, { align: 'center' });
    
    let y = 30;
    
    // Notas
    const notas = [
        { valor: 100, cor: [0, 100, 200], texto: 'CEM REAIS' },
        { valor: 50, cor: [200, 100, 0], texto: 'CINQUENTA REAIS' },
        { valor: 20, cor: [200, 0, 100], texto: 'VINTE REAIS' },
        { valor: 10, cor: [100, 200, 0], texto: 'DEZ REAIS' },
        { valor: 5, cor: [150, 0, 150], texto: 'CINCO REAIS' },
        { valor: 2, cor: [0, 150, 150], texto: 'DOIS REAIS' }
    ];
    
    notas.forEach(nota => {
        for (let i = 0; i < 3; i++) {
            const x = 20 + (i * 60);
            
            // Fundo da nota
            doc.setFillColor(nota.cor[0], nota.cor[1], nota.cor[2]);
            doc.rect(x, y, 50, 25, 'F');
            
            // Borda
            doc.setDrawColor(0);
            doc.setLineWidth(1);
            doc.rect(x, y, 50, 25);
            
            // Valor
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.text(`R$ ${nota.valor}`, x + 25, y + 10, { align: 'center' });
            
            // Texto
            doc.setFontSize(8);
            doc.text(nota.texto, x + 25, y + 18, { align: 'center' });
            
            // Código de barras simulado
            doc.setFontSize(6);
            doc.setTextColor(0);
            doc.text(`NOTA${nota.valor}${Date.now()}${i}`, x + 25, y + 23, { align: 'center' });
        }
        y += 35;
    });
    
    // Nova página para moedas
    doc.addPage();
    doc.setTextColor(0);
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('🪙 MOEDAS PARA RECORTAR - SUPER MERCADO INTERATIVO', 105, 15, { align: 'center' });
    
    y = 30;
    const moedas = [
        { valor: 1, cor: [200, 200, 0] },
        { valor: 0.50, cor: [150, 150, 150] },
        { valor: 0.25, cor: [180, 120, 60] },
        { valor: 0.10, cor: [200, 150, 100] },
        { valor: 0.05, cor: [150, 100, 50] },
        { valor: 0.01, cor: [100, 50, 25] }
    ];
    
    moedas.forEach(moeda => {
        for (let i = 0; i < 6; i++) {
            const x = 20 + (i % 6) * 30;
            const yPos = y + Math.floor(i / 6) * 30;
            
            // Círculo da moeda
            doc.setFillColor(moeda.cor[0], moeda.cor[1], moeda.cor[2]);
            doc.circle(x + 10, yPos + 10, 8, 'F');
            
            // Borda
            doc.setDrawColor(0);
            doc.setLineWidth(1);
            doc.circle(x + 10, yPos + 10, 8);
            
            // Valor
            doc.setTextColor(0);
            doc.setFontSize(8);
            doc.setFont(undefined, 'bold');
            doc.text(`R$${moeda.valor.toFixed(2)}`, x + 10, yPos + 12, { align: 'center' });
        }
        y += 40;
    });
    
    // Instruções
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('📋 INSTRUÇÕES:', 20, y + 20);
    doc.text('1. Recorte as notas e moedas seguindo as linhas', 20, y + 30);
    doc.text('2. Use para simular pagamentos no jogo', 20, y + 40);
    doc.text('3. Escaneie os códigos para identificar os valores', 20, y + 50);
    
    doc.save('dinheiro-para-recortar.pdf');
    mostrarNotificacao('Dinheiro para recortar gerado!', 'success');
}

// ===== SISTEMA DE CARTÃO DE CRÉDITO =====

function criarCartao(e) {
    e.preventDefault();
    
    const nome = document.getElementById('nomeCartao').value;
    const saldo = parseFloat(document.getElementById('saldoInicial').value);
    
    const cartao = {
        id: Date.now(),
        nome: nome,
        numero: gerarNumeroCartao(),
        codigo: gerarCodigoCartao(),
        saldo: saldo,
        dataCriacao: new Date().toLocaleDateString(),
        ativo: true
    };
    
    cartoes.push(cartao);
    localStorage.setItem('cartoes', JSON.stringify(cartoes));
    
    document.getElementById('formCartao').reset();
    atualizarListaCartoes();
    mostrarNotificacao('Cartão criado com sucesso!', 'success');
}

function gerarNumeroCartao() {
    return '4532' + Math.floor(Math.random() * 1000000000000).toString().padStart(12, '0');
}

function gerarCodigoCartao() {
    return 'CARD' + Math.floor(Math.random() * 1000000000000).toString();
}

function atualizarListaCartoes() {
    const container = document.getElementById('listaCartoes');
    
    if (cartoes.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-4">Nenhum cartão cadastrado</p>';
        return;
    }
    
    container.innerHTML = cartoes.map(cartao => `
        <div class="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-4 rounded-lg shadow-lg">
            <div class="flex justify-between items-start mb-2">
                <div>
                    <div class="font-bold text-lg">${cartao.nome}</div>
                    <div class="text-sm opacity-75">**** **** **** ${cartao.numero.slice(-4)}</div>
                </div>
                <div class="text-right">
                    <div class="text-2xl font-bold">R$ ${cartao.saldo.toFixed(2)}</div>
                    <div class="text-xs opacity-75">${cartao.dataCriacao}</div>
                </div>
            </div>
            <div class="flex gap-2 mt-3">
                <button onclick="adicionarSaldoCartao(${cartao.id})" class="flex-1 bg-white bg-opacity-20 hover:bg-opacity-30 py-1 px-2 rounded text-sm">
                    <i class="fas fa-plus mr-1"></i>Adicionar Saldo
                </button>
                <button onclick="excluirCartao(${cartao.id})" class="bg-red-500 hover:bg-red-600 py-1 px-2 rounded text-sm">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="text-xs mt-2 opacity-75">Código: ${cartao.codigo}</div>
        </div>
    `).join('');
}

function adicionarSaldoCartao(id) {
    const valor = prompt('Digite o valor a adicionar (R$):');
    if (!valor || isNaN(valor)) return;
    
    const cartao = cartoes.find(c => c.id === id);
    if (cartao) {
        cartao.saldo += parseFloat(valor);
        localStorage.setItem('cartoes', JSON.stringify(cartoes));
        atualizarListaCartoes();
        mostrarNotificacao(`R$ ${parseFloat(valor).toFixed(2)} adicionado ao cartão!`, 'success');
    }
}

function excluirCartao(id) {
    if (confirm('Tem certeza que deseja excluir este cartão?')) {
        cartoes = cartoes.filter(c => c.id !== id);
        localStorage.setItem('cartoes', JSON.stringify(cartoes));
        atualizarListaCartoes();
        mostrarNotificacao('Cartão excluído!', 'info');
    }
}

function iniciarScannerCartao() {
    // Usar o mesmo scanner, mas com lógica diferente
    if (scannerAtivo) return;
    
    document.getElementById('scanner-overlay').style.display = 'none';
    scannerAtivo = true;
    
    Quagga.init({
        inputStream: {
            name: "Live",
            type: "LiveStream",
            target: document.querySelector('#video'),
            constraints: {
                width: 640,
                height: 480,
                facingMode: "environment"
            }
        },
        decoder: {
            readers: [
                "code_128_reader",
                "ean_reader",
                "ean_8_reader",
                "code_39_reader"
            ]
        }
    }, function(err) {
        if (err) {
            console.log(err);
            alert('Erro ao iniciar a câmera. Verifique as permissões.');
            return;
        }
        Quagga.start();
    });
    
    Quagga.onDetected(function(data) {
        const codigo = data.codeResult.code;
        
        // Buscar cartão pelo código
        const cartao = cartoes.find(c => c.codigo === codigo);
        
        if (cartao) {
            cartaoAtual = cartao;
            document.getElementById('cartaoLido').classList.remove('hidden');
            document.getElementById('infoCartaoLido').innerHTML = `
                <div class="font-semibold text-lg">${cartao.nome}</div>
                <div class="text-blue-600 font-bold">**** **** **** ${cartao.numero.slice(-4)}</div>
                <div class="text-green-600 font-bold text-xl">Saldo: R$ ${cartao.saldo.toFixed(2)}</div>
            `;
            
            // Atualizar valores de pagamento
            const totalCarrinho = carrinho.reduce((sum, item) => sum + (item.preco * item.quantidade), 0);
            document.getElementById('valorCompraCartao').textContent = totalCarrinho.toFixed(2);
            document.getElementById('saldoCartaoAtual').textContent = cartao.saldo.toFixed(2);
            document.getElementById('saldoAposPagamento').textContent = (cartao.saldo - totalCarrinho).toFixed(2);
            
            pararScanner();
        }
        
        playBeep();
    });
}

function confirmarPagamentoCartao() {
    if (!cartaoAtual) {
        alert('Nenhum cartão selecionado!');
        return;
    }
    
    if (carrinho.length === 0) {
        alert('Carrinho vazio!');
        return;
    }
    
    const total = carrinho.reduce((sum, item) => sum + (item.preco * item.quantidade), 0);
    
    if (cartaoAtual.saldo < total) {
        alert('Saldo insuficiente no cartão!');
        return;
    }
    
    // Debitar do cartão
    cartaoAtual.saldo -= total;
    
    // Atualizar cartão no array
    const index = cartoes.findIndex(c => c.id === cartaoAtual.id);
    if (index !== -1) {
        cartoes[index] = cartaoAtual;
        localStorage.setItem('cartoes', JSON.stringify(cartoes));
    }
    
    // Registrar transação
    const transacao = {
        id: Date.now(),
        cartaoId: cartaoAtual.id,
        nomeCartao: cartaoAtual.nome,
        valor: total,
        tipo: 'debito',
        data: new Date().toLocaleString(),
        itens: [...carrinho]
    };
    
    transacoesCartao.push(transacao);
    localStorage.setItem('transacoesCartao', JSON.stringify(transacoesCartao));
    
    // Registrar venda
    const venda = {
        id: Date.now(),
        itens: [...carrinho],
        total: total,
        metodoPagamento: 'cartao',
        cartao: cartaoAtual.nome,
        data: new Date().toLocaleString(),
        quantidadeItens: carrinho.reduce((sum, item) => sum + item.quantidade, 0)
    };
    
    vendas.push(venda);
    localStorage.setItem('vendas', JSON.stringify(vendas));
    
    // Mostrar modal de sucesso
    document.getElementById('totalFinal').textContent = total.toFixed(2);
    document.getElementById('modalSucesso').classList.remove('hidden');
    document.getElementById('modalSucesso').classList.add('flex');
    
    // Limpar tudo
    carrinho = [];
    cartaoAtual = null;
    cancelarPagamentoCartao();
    atualizarCarrinho();
    atualizarListaCartoes();
    atualizarHistoricoTransacoes();
    atualizarRelatorioVendas();
    atualizarContadores();
    
    mostrarNotificacao('Pagamento com cartão aprovado!', 'success');
}

function cancelarPagamentoCartao() {
    cartaoAtual = null;
    document.getElementById('cartaoLido').classList.add('hidden');
    document.getElementById('valorCompraCartao').textContent = '0,00';
    document.getElementById('saldoCartaoAtual').textContent = '0,00';
    document.getElementById('saldoAposPagamento').textContent = '0,00';
}

function atualizarHistoricoTransacoes() {
    const container = document.getElementById('historicoTransacoes');
    const ultimasTransacoes = transacoesCartao.slice(-5).reverse();
    
    if (ultimasTransacoes.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-4">Nenhuma transação realizada</p>';
        return;
    }
    
    container.innerHTML = ultimasTransacoes.map(transacao => `
        <div class="bg-gray-50 p-3 rounded-lg">
            <div class="flex justify-between items-center">
                <span class="font-semibold">${transacao.nomeCartao}</span>
                <span class="text-red-600 font-bold">-R$ ${transacao.valor.toFixed(2)}</span>
            </div>
            <div class="text-sm text-gray-600">${new Date(transacao.data).toLocaleString()}</div>
        </div>
    `).join('');
}

// Imprimir cartões para recortar
function imprimirCartoes() {
    if (cartoes.length === 0) {
        alert('Nenhum cartão cadastrado para imprimir!');
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('💳 CARTÕES PARA RECORTAR - SUPER MERCADO INTERATIVO', 105, 15, { align: 'center' });
    
    let y = 30;
    
    cartoes.forEach((cartao, index) => {
        if (index > 0 && index % 3 === 0) {
            doc.addPage();
            y = 30;
            doc.setFontSize(16);
            doc.setFont(undefined, 'bold');
            doc.text('💳 CARTÕES PARA RECORTAR - SUPER MERCADO INTERATIVO', 105, 15, { align: 'center' });
        }
        
        const x = 20;
        
        // Fundo do cartão
        doc.setFillColor(75, 85, 200);
        doc.roundedRect(x, y, 85, 54, 5, 5, 'F');
        
        // Borda
        doc.setDrawColor(0);
        doc.setLineWidth(1);
        doc.roundedRect(x, y, 85, 54, 5, 5);
        
        // Nome do banco
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('SUPER MERCADO BANK', x + 5, y + 10);
        
        // Número do cartão
        doc.setFontSize(12);
        doc.setFont(undefined, 'normal');
        const numeroFormatado = cartao.numero.match(/.{1,4}/g).join(' ');
        doc.text(numeroFormatado, x + 5, y + 25);
        
        // Nome do portador
        doc.setFontSize(8);
        doc.setFont(undefined, 'bold');
        doc.text(cartao.nome.toUpperCase(), x + 5, y + 35);
        
        // Saldo
        doc.setFontSize(10);
        doc.text(`SALDO: R$ ${cartao.saldo.toFixed(2)}`, x + 5, y + 45);
        
        // Código de barras
        doc.setFontSize(6);
        doc.setTextColor(0);
        doc.text(`Código: ${cartao.codigo}`, x + 5, y + 52);
        
        // Chip simulado
        doc.setFillColor(255, 215, 0);
        doc.rect(x + 65, y + 15, 15, 12, 'F');
        doc.setDrawColor(0);
        doc.rect(x + 65, y + 15, 15, 12);
        
        y += 70;
    });
    
    // Instruções
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('📋 INSTRUÇÕES:', 20, y + 10);
    doc.text('1. Recorte os cartões seguindo as linhas', 20, y + 20);
    doc.text('2. Use o scanner para ler o código do cartão', 20, y + 30);
    doc.text('3. Simule pagamentos com os cartões criados', 20, y + 40);
    
    doc.save('cartoes-para-recortar.pdf');
    mostrarNotificacao('Cartões para recortar gerados!', 'success');
}

// ===== FUNÇÕES PWA E PERSISTÊNCIA =====

// Carregar todos os dados salvos
function carregarDadosSalvos() {
    try {
        // Carregar dados do localStorage
        produtos = JSON.parse(localStorage.getItem('produtos')) || [];
        vendas = JSON.parse(localStorage.getItem('vendas')) || [];
        caixa = JSON.parse(localStorage.getItem('caixa')) || {
            notas100: 0, notas50: 0, notas20: 0, notas10: 0, notas5: 0, notas2: 0,
            moedas1: 0, moedas050: 0, moedas025: 0, moedas010: 0, moedas005: 0, moedas001: 0
        };
        cartoes = JSON.parse(localStorage.getItem('cartoes')) || [];
        transacoesCartao = JSON.parse(localStorage.getItem('transacoesCartao')) || [];
        
        // Carregar configurações do app
        const configuracoes = JSON.parse(localStorage.getItem('configuracoes')) || {};
        if (configuracoes.tema) {
            document.body.className = configuracoes.tema;
        }
        
        console.log('Dados carregados com sucesso');
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        mostrarNotificacao('Erro ao carregar dados salvos', 'error');
    }
}

// Salvar todos os dados
function salvarTodosDados() {
    try {
        localStorage.setItem('produtos', JSON.stringify(produtos));
        localStorage.setItem('vendas', JSON.stringify(vendas));
        localStorage.setItem('caixa', JSON.stringify(caixa));
        localStorage.setItem('cartoes', JSON.stringify(cartoes));
        localStorage.setItem('transacoesCartao', JSON.stringify(transacoesCartao));
        
        // Salvar timestamp da última sincronização
        localStorage.setItem('ultimaAtualizacao', new Date().toISOString());
        
        console.log('Dados salvos automaticamente');
    } catch (error) {
        console.error('Erro ao salvar dados:', error);
        mostrarNotificacao('Erro ao salvar dados', 'error');
    }
}

// Sincronizar dados (para futuras implementações online)
function sincronizarDados() {
    try {
        // Aqui você pode implementar sincronização com servidor
        console.log('Sincronização de dados iniciada');
        
        // Por enquanto, apenas salva localmente
        salvarTodosDados();
        
        mostrarNotificacao('Dados sincronizados!', 'success');
    } catch (error) {
        console.error('Erro na sincronização:', error);
    }
}

// Mostrar botão de instalação PWA
function mostrarBotaoInstalar() {
    const botaoInstalar = document.createElement('button');
    botaoInstalar.innerHTML = '<i class="fas fa-download mr-2"></i>Instalar App';
    botaoInstalar.className = 'fixed bottom-4 right-4 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-all';
    botaoInstalar.id = 'botaoInstalar';
    
    botaoInstalar.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            
            if (outcome === 'accepted') {
                mostrarNotificacao('App instalado com sucesso!', 'success');
            }
            
            deferredPrompt = null;
            botaoInstalar.remove();
        }
    });
    
    document.body.appendChild(botaoInstalar);
    
    // Remover botão após 10 segundos se não usado
    setTimeout(() => {
        if (document.getElementById('botaoInstalar')) {
            botaoInstalar.remove();
        }
    }, 10000);
}

// Backup e restauração de dados
function exportarDados() {
    try {
        const dadosCompletos = {
            produtos: produtos,
            vendas: vendas,
            caixa: caixa,
            cartoes: cartoes,
            transacoesCartao: transacoesCartao,
            dataExportacao: new Date().toISOString(),
            versao: '1.0.0'
        };
        
        const dataStr = JSON.stringify(dadosCompletos, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `super-mercado-backup-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        mostrarNotificacao('Backup criado com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao exportar dados:', error);
        mostrarNotificacao('Erro ao criar backup', 'error');
    }
}

function importarDados(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const dadosImportados = JSON.parse(e.target.result);
            
            // Validar estrutura dos dados
            if (dadosImportados.produtos && Array.isArray(dadosImportados.produtos)) {
                produtos = dadosImportados.produtos;
                localStorage.setItem('produtos', JSON.stringify(produtos));
            }
            
            if (dadosImportados.vendas && Array.isArray(dadosImportados.vendas)) {
                vendas = dadosImportados.vendas;
                localStorage.setItem('vendas', JSON.stringify(vendas));
            }
            
            if (dadosImportados.caixa) {
                caixa = dadosImportados.caixa;
                localStorage.setItem('caixa', JSON.stringify(caixa));
            }
            
            if (dadosImportados.cartoes && Array.isArray(dadosImportados.cartoes)) {
                cartoes = dadosImportados.cartoes;
                localStorage.setItem('cartoes', JSON.stringify(cartoes));
            }
            
            if (dadosImportados.transacoesCartao && Array.isArray(dadosImportados.transacoesCartao)) {
                transacoesCartao = dadosImportados.transacoesCartao;
                localStorage.setItem('transacoesCartao', JSON.stringify(transacoesCartao));
            }
            
            // Atualizar interface
            atualizarContadores();
            atualizarListaProdutos();
            atualizarRelatorioVendas();
            atualizarCaixa();
            atualizarListaCartoes();
            atualizarHistoricoTransacoes();
            
            mostrarNotificacao('Dados importados com sucesso!', 'success');
        } catch (error) {
            console.error('Erro ao importar dados:', error);
            mostrarNotificacao('Erro ao importar dados. Verifique o arquivo.', 'error');
        }
    };
    
    reader.readAsText(file);
}

// Limpar todos os dados
function limparTodosDados() {
    if (confirm('⚠️ ATENÇÃO: Isso irá apagar TODOS os dados do app (produtos, vendas, caixa, cartões). Esta ação não pode ser desfeita. Tem certeza?')) {
        if (confirm('Última confirmação: Realmente deseja apagar TUDO?')) {
            localStorage.clear();
            
            // Resetar variáveis
            produtos = [];
            vendas = [];
            carrinho = [];
            caixa = {
                notas100: 0, notas50: 0, notas20: 0, notas10: 0, notas5: 0, notas2: 0,
                moedas1: 0, moedas050: 0, moedas025: 0, moedas010: 0, moedas005: 0, moedas001: 0
            };
            cartoes = [];
            transacoesCartao = [];
            cartaoAtual = null;
            produtoAtual = null;
            valorPagar = 0;
            valorRecebido = 0;
            
            // Atualizar interface
            atualizarContadores();
            atualizarListaProdutos();
            atualizarRelatorioVendas();
            atualizarCaixa();
            atualizarListaCartoes();
            atualizarHistoricoTransacoes();
            atualizarCarrinho();
            
            mostrarNotificacao('Todos os dados foram apagados!', 'info');
            
            // Recarregar página após 2 segundos
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        }
    }
}

// Detectar quando o app perde foco para salvar dados
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        salvarTodosDados();
    }
});

// Detectar gestos de toque para melhor UX mobile
let touchStartY = 0;
let touchEndY = 0;

document.addEventListener('touchstart', e => {
    touchStartY = e.changedTouches[0].screenY;
});

document.addEventListener('touchend', e => {
    touchEndY = e.changedTouches[0].screenY;
    handleSwipe();
});

function handleSwipe() {
    const swipeThreshold = 50;
    const diff = touchStartY - touchEndY;
    
    if (Math.abs(diff) > swipeThreshold) {
        if (diff > 0) {
            // Swipe up - pode implementar ações específicas
            console.log('Swipe up detectado');
        } else {
            // Swipe down - pode implementar ações específicas
            console.log('Swipe down detectado');
        }
    }
}

// Adicionar botão de configurações no header
function adicionarBotaoConfiguracoes() {
    const header = document.querySelector('header .container');
    const botaoConfig = document.createElement('button');
    botaoConfig.innerHTML = '<i class="fas fa-cog"></i>';
    botaoConfig.className = 'bg-white bg-opacity-20 hover:bg-opacity-30 text-white p-2 rounded-full transition-all';
    botaoConfig.onclick = mostrarMenuConfiguracoes;
    
    header.appendChild(botaoConfig);
}

function mostrarMenuConfiguracoes() {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white rounded-xl p-6 max-w-md mx-4 w-full">
            <h3 class="text-xl font-bold mb-4 flex items-center">
                <i class="fas fa-cog mr-2"></i>Configurações
            </h3>
            <div class="space-y-4">
                <button onclick="exportarDados()" class="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg">
                    <i class="fas fa-download mr-2"></i>Exportar Dados
                </button>
                <label class="w-full bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg cursor-pointer block text-center">
                    <i class="fas fa-upload mr-2"></i>Importar Dados
                    <input type="file" accept=".json" onchange="importarDados(event)" class="hidden">
                </label>
                <button onclick="sincronizarDados()" class="w-full bg-purple-500 hover:bg-purple-600 text-white py-2 px-4 rounded-lg">
                    <i class="fas fa-sync mr-2"></i>Sincronizar
                </button>
                <button onclick="limparTodosDados()" class="w-full bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg">
                    <i class="fas fa-trash mr-2"></i>Limpar Todos os Dados
                </button>
                <div class="text-center text-sm text-gray-500 pt-4 border-t">
                    <p>Super Mercado Interativo v1.0.0</p>
                    <p>Última atualização: ${localStorage.getItem('ultimaAtualizacao') ? new Date(localStorage.getItem('ultimaAtualizacao')).toLocaleString() : 'Nunca'}</p>
                </div>
            </div>
            <button onclick="this.parentElement.parentElement.remove()" class="mt-4 w-full bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-lg">
                Fechar
            </button>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Inicializar produtos de exemplo apenas se não houver dados
if (produtos.length === 0) {
    const produtosExemplo = [
        { id: 1, nome: 'Coca-Cola 350ml', preco: 4.50, codigo: '7894900011517', categoria: 'bebidas', dataCadastro: new Date().toLocaleDateString() },
        { id: 2, nome: 'Pão de Açúcar', preco: 6.90, codigo: '7891234567890', categoria: 'alimentos', dataCadastro: new Date().toLocaleDateString() },
        { id: 3, nome: 'Detergente Ypê', preco: 2.99, codigo: '7896098765432', categoria: 'limpeza', dataCadastro: new Date().toLocaleDateString() },
        { id: 4, nome: 'Shampoo Seda', preco: 12.90, codigo: '7891098765432', categoria: 'higiene', dataCadastro: new Date().toLocaleDateString() },
        { id: 5, nome: 'Chocolate Lacta', preco: 8.50, codigo: '7622210987654', categoria: 'doces', dataCadastro: new Date().toLocaleDateString() }
    ];
    
    produtos = produtosExemplo;
    localStorage.setItem('produtos', JSON.stringify(produtos));
}

// Adicionar botão de configurações após carregar
setTimeout(() => {
    adicionarBotaoConfiguracoes();
}, 1000);

// Mostrar seção inicial
showSection('cadastro');