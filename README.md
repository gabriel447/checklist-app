# Checklist

Aplicativo móvel e web construído com Expo e React Native para registrar checklists de instalação/reparo. Permite coletar dados do cliente, localização via Google Maps, fotos (CTO, frente da casa, instalação, MAC), autenticação de usuário e persistência no Supabase. Também exporta relatório em PDF e permite compartilhamento.

## Tecnologias

- Expo SDK 54 (`expo@54.0.23`) e EAS Build
- React (`19.1.0`) e React Native (`0.81.5`)
- Web: `react-dom@19.1.0` e `react-native-web@0.21.0`
- Back-end: `@supabase/supabase-js@^2` (tabelas `users` e `checklists`)
- Sessão (mobile): `@react-native-async-storage/async-storage@^2.2.0`
- Arquivos: `expo-file-system@19.0.17`
- Imagens: `expo-image-picker@^17.0.8`
- Localização: `expo-location@^19.0.7`
- PDF: `expo-print@~15.0.7`
- Compartilhamento: `expo-sharing@~14.0.7`
- UI: `expo-status-bar@~3.0.8` e `react-native-safe-area-context@~5.6.0`
- Ícones: `@expo/vector-icons` (Feather, MaterialCommunityIcons)

Permissões Android: `CAMERA` e `ACCESS_FINE_LOCATION`. No iOS, mensagens de uso de localização estão configuradas em `app.json`.

## Ambiente

Crie um arquivo `.env` na raiz baseado em `.env.example`:

```env
EXPO_PUBLIC_SUPABASE_KEY=seu_supabase_key
EXPO_PUBLIC_SUPABASE_URL=https://sua-instancia.supabase.co
```

Para builds com EAS, defina essas variáveis como Secrets no projeto (via CLI ou Dashboard). Se as variáveis não estiverem configuradas, o app exibe uma tela informando configuração ausente.

## Como usar

### Pré-requisitos

- Node.js LTS e npm
- Android Studio (para rodar em Android) e/ou Xcode (para iOS)

### Instalação

```bash
npm install
```

### Comandos

- `npm run start` — inicia o servidor de desenvolvimento do Expo (QR code, Metro bundler)
- `npm run android` — inicia no emulador/dispositivo Android (abre Expo Go/DEV Client)
- `npm run ios` — inicia no simulador iOS
- `npm run web` — roda no navegador usando `react-native-web`
- `npm run android:clean` — limpa o cache e inicia no Android
- `npm run ios:clean` — limpa o cache e inicia no iOS
- `npm run web:clean` — limpa o cache e inicia na Web

### Fluxo básico no app

1. Faça login ou cadastre-se (autenticação via Supabase).
2. Preencha as seções do checklist:
   - Dados do cliente: nome, rua/número, link de localização
   - CTO/rede externa: link da CTO, cor da fibra, splitter, porta
   - Casa do cliente: link e foto da frente
   - Instalação interna: fotos da instalação e MAC, Wi‑Fi
   - Finalização: testes e satisfação
3. Use os botões para:
   - Puxar localização atual (gera link do Maps)
   - Capturar/selecionar fotos
4. Salve o checklist.
5. Exporte para PDF quando necessário e compartilhe.

### Autenticação e perfil

- Login e cadastro com e‑mail/senha.
- Validação forte de senha e formatação/validação de CPF e telefone.
- Atualização de perfil (nome, telefone, CPF) sincronizada na tabela `users`.

### Recuperação de senha

- Fluxo via Edge Functions do Supabase:
  - `reset-code-send` — gera código de 6 dígitos e envia e‑mail.
  - `reset-code-verify` — valida código (`valid: true/false`).
  - `reset-password-apply` — aplica nova senha e marca o código como usado.
- Secrets necessários nas Functions:
  - `SENDGRID_API_KEY` e `MAIL_FROM` para envio de e‑mail.
  - `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` para acesso às tabelas.
- Recomendações de implementação das Functions:
  - Importar `@supabase/supabase-js@2.81.1` via `https://esm.sh/@supabase/supabase-js@2.81.1`.
  - Responder com `Content-Type: application/json` e incluir CORS.
  - Normalizar e‑mail para minúsculas (`toLowerCase()`).
  - Na aplicação da senha, atualizar `used_at` do registro do código.
- Comportamento no app:
  - Após `valid: true`, o app navega para a tela de **Alterar senha**.
  - Ao salvar a nova senha, a tela de **Login** é aberta já com e‑mail e senha preenchidos para facilitar o acesso.

### Builds (opcional)

O projeto inclui `eas.json` com perfis de build. Para usar EAS Build:

```bash
eas build --profile preview --platform android
eas build --profile production --platform android
```

Requer instalação do EAS CLI (`npm i -g eas-cli`) e configuração de contas/stores, além dos Secrets do Supabase.

## Estrutura

- `App.js` — UI principal, fluxo do checklist e telas de autenticação
- `index.js` — registro do componente raiz e Boundary de erro
- `db.js` — integração unificada com Supabase (web e mobile)
- `utils.js` — utilidades de formatação/validação, links do Maps e arquivos
- `styles.js` — estilos compartilhados e utilitários de UI
- `.env.example` — variáveis de ambiente necessárias
- `app.json` — configurações do projeto (ícones, permissões, web)
- `eas.json` — perfis de build do EAS
- `assets/` — ícones e splash
- `web/index.html` — HTML base para a versão web

## Observações

- Sem `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_KEY` o app não funciona; configure `.env` para desenvolvimento e Secrets no EAS para builds.
- No mobile, fotos podem estar em formatos diversos; a exportação para PDF faz fallback para JPEG quando o tipo não é reconhecido.
- As permissões de câmera e localização já estão declaradas em `app.json`.
 - O dump do banco associado ao projeto está em `supabase/dump.sql`.