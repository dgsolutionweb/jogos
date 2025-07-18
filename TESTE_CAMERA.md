# 🎥 Teste da Câmera - Guia de Diagnóstico

## Problemas Solucionados

✅ **Função de inicialização melhorada** - Agora testa a câmera primeiro antes de iniciar o Quagga
✅ **Melhor limpeza de recursos** - Libera corretamente a câmera ao parar o scanner
✅ **Botão de teste dedicado** - Permite testar a câmera sem o scanner
✅ **Mensagens de erro mais claras** - Indica exatamente o que fazer em cada situação

## Como Testar

### 1. **Teste Básico da Câmera**
- Abra a aplicação
- Vá para a seção "Scanner"
- Clique no botão **"Testar Câmera"** (azul)
- Se a câmera aparecer por 5 segundos, o problema não é com a câmera

### 2. **Teste do Scanner**
- Clique em **"Iniciar Scanner"**
- Agora deve mostrar a câmera funcionando
- Se continuar branco, observe os erros no console (F12)

### 3. **Verificar Permissões**
- Verifique se o navegador pediu permissão para a câmera
- No Chrome: Clique no ícone de câmera na barra de endereço
- Certifique-se que está em HTTPS (para dispositivos móveis)

## Soluções de Problemas

### 🚫 **Tela Branca no Scanner**
**Possíveis causas:**
- Permissão de câmera negada
- Câmera sendo usada por outro app
- Navegador não suporta a API
- Problema com o Quagga.js

**O que fazer:**
1. Clique em "Testar Câmera" primeiro
2. Se o teste funcionar, o problema é com o Quagga
3. Se o teste não funcionar, é problema de permissão/hardware

### 📱 **Em Dispositivos Móveis**
- Use HTTPS obrigatoriamente
- Teste em Chrome/Firefox/Safari
- Verifique se não há outros apps usando a câmera

### 💻 **Em Desktop**
- Verifique se há uma webcam conectada
- Teste em navegadores diferentes
- Verifique se antivírus não está bloqueando

## Códigos de Erro Comuns

| Erro | Significado | Solução |
|------|-------------|---------|
| `NotAllowedError` | Permissão negada | Permitir câmera nas configurações |
| `NotFoundError` | Câmera não encontrada | Verificar hardware/conexão |
| `NotSupportedError` | Não suportado | Usar navegador mais novo |

## Console do Navegador (F12)

Procure por estas mensagens:
- ✅ `"Câmera funcionando corretamente"` - Teste OK
- ✅ `"Quagga iniciado com sucesso"` - Scanner OK
- ❌ `"Erro de acesso à câmera"` - Problema de permissão
- ❌ `"Erro do Quagga"` - Problema do scanner

## Próximos Passos

Se ainda não funcionar:
1. Teste em outro navegador
2. Teste em outro dispositivo
3. Verifique se está em HTTPS
4. Reporte o erro específico do console
