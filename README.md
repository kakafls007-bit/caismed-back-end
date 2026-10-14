# CaisMed API — Node.js + Express + MySQL

API inicial preparada para integrar o front-end existente. O front atualmente usa `localStorage`/`sessionStorage`; estas rotas são o começo da substituição por requisições REST.

## Requisitos
- Node.js 20+
- MySQL 8.0+
- Script `caismed.sql` revisado, executado antes da API

## Instalação
```bash
npm install
cp .env.example .env
```
No Windows PowerShell, também pode copiar o arquivo manualmente:
```powershell
Copy-Item .env.example .env
```
Edite `.env` e configure credenciais do MySQL, `FRONTEND_ORIGIN` e um `JWT_SECRET` aleatório com pelo menos 32 caracteres. Não publique o `.env`.

## Banco de dados
1. Execute `caismed.sql` no MySQL Workbench.
2. Crie um usuário MySQL exclusivo para a aplicação com privilégios mínimos no banco `caismed`.
3. Preencha `DB_USER` e `DB_PASSWORD` no `.env`.

## Criar profissional de demonstração
O front mostra `1001 / caismed123` como mock local. A API não aceita essa senha automaticamente. Para criar uma conta real de desenvolvimento, defina a senha por variável de ambiente e rode:
```powershell
$env:SEED_PROF_MATRICULA="1001"
$env:SEED_PROF_NOME="Profissional Demonstração"
$env:SEED_PROF_SENHA="uma-senha-forte-aqui"
npm run seed:profissional
```
Use outra senha fora de ambiente de demonstração. O script não imprime nem salva a senha.

## Executar
```bash
npm run dev
```
Health check: `GET http://localhost:3000/api/health`

## Rotas iniciais
| Método | Rota | Acesso |
|---|---|---|
| GET | `/api/health` | Público |
| POST | `/api/auth/login` | Público; CPF e senha |
| POST | `/api/auth/profissional/login` | Público; matrícula e senha |
| POST | `/api/auth/primeiro-acesso` | Público; paciente pré-cadastrado |
| GET | `/api/auth/me` | Token |
| GET | `/api/planos` | Público |
| POST | `/api/clientes` | Profissional/Admin |
| GET | `/api/clientes` | Profissional/Admin |
| GET | `/api/clientes/:id` | Próprio paciente ou Profissional/Admin |
| PUT | `/api/clientes/:id` | Próprio paciente ou Profissional/Admin |
| GET | `/api/clientes/:id/faturas` | Dono do cadastro ou Profissional/Admin |
| GET | `/api/consultas` | Paciente vê as próprias; profissional vê as atribuídas; Admin vê todas |
| POST | `/api/consultas` | Paciente/Profissional/Admin |
| PATCH | `/api/consultas/:id` | Dono, profissional responsável ou Admin, conforme status |

Todas as rotas protegidas usam:
```http
Authorization: Bearer <token>
```

## Contratos principais

Login paciente:
```json
{ "cpf": "12345678901", "senha": "senha-definida-no-primeiro-acesso" }
```

Login profissional:
```json
{ "matricula": "1001", "senha": "senha-forte" }
```

Cadastro de paciente:
```json
{
  "nome": "Paciente de Demonstração",
  "cpf": "12345678901",
  "nascimento": "1998-04-21",
  "telefone": "81999999999",
  "email": "paciente@example.com",
  "cidade": "Recife",
  "plano": "essencial"
}
```
O `POST /api/clientes` exige token de profissional/admin.

Agendamento:
```json
{
  "especialidadeId": 1,
  "inicio": "2026-10-15T13:00:00",
  "fim": "2026-10-15T13:30:00",
  "profissionalId": 1,
  "clinicaId": 1
}
```
Para paciente, o `pacienteId` é extraído do token. Os IDs devem existir no banco. A lista inicial de especialidades é criada pelo SQL.

## Importante: estado do projeto
- Este é um scaffold inicial, não uma integração ponta a ponta concluída.
- O front-end ainda precisa ser adaptado para usar `fetch`, guardar o token de forma apropriada e lidar com erros HTTP.
- O fluxo de primeiro acesso só usa CPF e senha para corresponder ao front atual; **não é adequado para produção** sem código de ativação ou verificação de identidade por canal confiável.
- O front tem pagamentos simulados. Não existe integração com banco/provedor de pagamento neste pacote e nenhuma fatura é automaticamente marcada como paga.
- Triagem por áudio/IA, recuperação de senha, gestão de clínicas/profissionais/disponibilidade e Swagger/OpenAPI ainda precisam ser implementados.
- A prevenção de colisões de horário nesta primeira versão é básica e precisa de validação/testes concorrentes antes de uso real.
- Dados pessoais e de saúde são sensíveis. Use somente dados fictícios em desenvolvimento e restrinja acesso.
