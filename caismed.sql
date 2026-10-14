-- CaisMed — esquema revisado conforme o front-end recebido
-- MySQL 8.0+
-- Execute em ambiente de desenvolvimento. Não contém credenciais nem dados reais.

CREATE DATABASE IF NOT EXISTS caismed
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE caismed;

CREATE TABLE IF NOT EXISTS planos (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(30) NOT NULL UNIQUE,
  nome VARCHAR(100) NOT NULL,
  descricao VARCHAR(500) NULL,
  valor_mensal DECIMAL(10,2) NOT NULL,
  limite_dependentes TINYINT UNSIGNED NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_planos_valor CHECK (valor_mensal >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS usuarios (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  email VARCHAR(254) NULL,
  senha_hash VARCHAR(255) NULL,
  perfil ENUM('PACIENTE','PROFISSIONAL','ADMIN') NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  ultimo_login_em DATETIME NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_usuarios_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pacientes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id BIGINT UNSIGNED NULL,
  nome VARCHAR(120) NOT NULL,
  cpf CHAR(11) NOT NULL,
  data_nascimento DATE NULL,
  telefone VARCHAR(25) NULL,
  email VARCHAR(254) NULL,
  cidade VARCHAR(100) NULL,
  plano_id BIGINT UNSIGNED NULL,
  primeiro_acesso_concluido BOOLEAN NOT NULL DEFAULT FALSE,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_por_usuario_id BIGINT UNSIGNED NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pacientes_cpf (cpf),
  UNIQUE KEY uq_pacientes_usuario (usuario_id),
  KEY idx_pacientes_nome (nome),
  CONSTRAINT fk_pacientes_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_pacientes_plano FOREIGN KEY (plano_id) REFERENCES planos(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_pacientes_criado_por FOREIGN KEY (criado_por_usuario_id) REFERENCES usuarios(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS profissionais (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id BIGINT UNSIGNED NOT NULL,
  matricula VARCHAR(30) NOT NULL,
  registro_conselho VARCHAR(40) NULL,
  tipo_conselho VARCHAR(20) NULL,
  uf_conselho CHAR(2) NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE KEY uq_profissionais_usuario (usuario_id),
  UNIQUE KEY uq_profissionais_matricula (matricula),
  CONSTRAINT fk_profissionais_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS clinicas (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(160) NOT NULL,
  cnpj VARCHAR(18) NULL,
  telefone VARCHAR(25) NULL,
  email VARCHAR(254) NULL,
  logradouro VARCHAR(160) NULL,
  numero VARCHAR(20) NULL,
  complemento VARCHAR(100) NULL,
  bairro VARCHAR(100) NULL,
  cidade VARCHAR(100) NULL,
  uf CHAR(2) NULL,
  cep VARCHAR(9) NULL,
  ativa BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_clinicas_cnpj (cnpj),
  KEY idx_clinicas_nome (nome)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS especialidades (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(40) NOT NULL UNIQUE,
  nome VARCHAR(100) NOT NULL UNIQUE,
  descricao VARCHAR(500) NULL,
  ativa BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS profissional_clinicas (
  profissional_id BIGINT UNSIGNED NOT NULL,
  clinica_id BIGINT UNSIGNED NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (profissional_id, clinica_id),
  CONSTRAINT fk_pc_profissional FOREIGN KEY (profissional_id) REFERENCES profissionais(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_pc_clinica FOREIGN KEY (clinica_id) REFERENCES clinicas(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS profissional_especialidades (
  profissional_id BIGINT UNSIGNED NOT NULL,
  especialidade_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (profissional_id, especialidade_id),
  CONSTRAINT fk_pe_profissional FOREIGN KEY (profissional_id) REFERENCES profissionais(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_pe_especialidade FOREIGN KEY (especialidade_id) REFERENCES especialidades(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS disponibilidades (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  profissional_id BIGINT UNSIGNED NOT NULL,
  clinica_id BIGINT UNSIGNED NOT NULL,
  inicio DATETIME NOT NULL,
  fim DATETIME NOT NULL,
  duracao_consulta_min SMALLINT UNSIGNED NOT NULL DEFAULT 30,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_disp_prof_inicio (profissional_id, inicio),
  CONSTRAINT chk_disponibilidade_intervalo CHECK (fim > inicio),
  CONSTRAINT chk_disponibilidade_duracao CHECK (duracao_consulta_min > 0),
  CONSTRAINT fk_disp_vinculo FOREIGN KEY (profissional_id, clinica_id)
    REFERENCES profissional_clinicas(profissional_id, clinica_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS triagens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  paciente_id BIGINT UNSIGNED NOT NULL,
  respostas JSON NOT NULL,
  especialidade_sugerida_id BIGINT UNSIGNED NULL,
  observacao_orientativa VARCHAR(1000) NULL,
  status ENUM('INICIADA','CONCLUIDA','ENCERRADA') NOT NULL DEFAULT 'INICIADA',
  criada_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_triagem_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_triagem_especialidade FOREIGN KEY (especialidade_sugerida_id) REFERENCES especialidades(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS consultas (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  paciente_id BIGINT UNSIGNED NOT NULL,
  profissional_id BIGINT UNSIGNED NULL,
  clinica_id BIGINT UNSIGNED NULL,
  especialidade_id BIGINT UNSIGNED NOT NULL,
  triagem_id BIGINT UNSIGNED NULL,
  inicio DATETIME NULL,
  fim DATETIME NULL,
  status ENUM('PENDENTE_AGENDAMENTO','AGENDADA','CONFIRMADA','CANCELADA','REALIZADA','FALTOU') NOT NULL DEFAULT 'PENDENTE_AGENDAMENTO',
  observacao_paciente VARCHAR(500) NULL,
  cancelada_em DATETIME NULL,
  motivo_cancelamento VARCHAR(300) NULL,
  criada_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizada_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_consultas_paciente_inicio (paciente_id, inicio),
  KEY idx_consultas_profissional_inicio_status (profissional_id, inicio, status),
  KEY idx_consultas_status_inicio (status, inicio),
  CONSTRAINT chk_consulta_intervalo CHECK (fim IS NULL OR inicio IS NULL OR fim > inicio),
  CONSTRAINT fk_consulta_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_consulta_profissional FOREIGN KEY (profissional_id) REFERENCES profissionais(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_consulta_clinica FOREIGN KEY (clinica_id) REFERENCES clinicas(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_consulta_especialidade FOREIGN KEY (especialidade_id) REFERENCES especialidades(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_consulta_triagem FOREIGN KEY (triagem_id) REFERENCES triagens(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS faturas (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  paciente_id BIGINT UNSIGNED NOT NULL,
  plano_id BIGINT UNSIGNED NOT NULL,
  competencia CHAR(7) NOT NULL COMMENT 'Formato YYYY-MM',
  valor DECIMAL(10,2) NOT NULL,
  vencimento DATE NOT NULL,
  status ENUM('PENDENTE','PAGA','VENCIDA','CANCELADA') NOT NULL DEFAULT 'PENDENTE',
  criada_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizada_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_fatura_paciente_competencia (paciente_id, competencia),
  KEY idx_faturas_status_vencimento (status, vencimento),
  CONSTRAINT chk_fatura_valor CHECK (valor >= 0),
  CONSTRAINT fk_fatura_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_fatura_plano FOREIGN KEY (plano_id) REFERENCES planos(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pagamentos (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  fatura_id BIGINT UNSIGNED NOT NULL,
  metodo ENUM('PIX','CARTAO','BOLETO') NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  status ENUM('INICIADO','PENDENTE','PROCESSANDO','CONFIRMADO','FALHOU','CANCELADO','ESTORNADO') NOT NULL DEFAULT 'INICIADO',
  referencia_gateway VARCHAR(120) NULL,
  pago_em DATETIME NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_pagamentos_fatura (fatura_id),
  CONSTRAINT chk_pagamento_valor CHECK (valor >= 0),
  CONSTRAINT fk_pagamento_fatura FOREIGN KEY (fatura_id) REFERENCES faturas(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS carteirinhas (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  paciente_id BIGINT UNSIGNED NOT NULL,
  numero VARCHAR(40) NOT NULL,
  validade DATE NULL,
  status ENUM('ATIVA','SUSPENSA','CANCELADA','VENCIDA') NOT NULL DEFAULT 'ATIVA',
  criada_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_carteirinha_numero (numero),
  UNIQUE KEY uq_carteirinha_paciente (paciente_id),
  CONSTRAINT fk_carteirinha_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

INSERT IGNORE INTO planos (codigo, nome, descricao, valor_mensal, limite_dependentes) VALUES
 ('essencial', 'Plano Essencial', 'Consultas básicas e telemedicina', 89.90, 0),
 ('conforto', 'Plano Conforto', 'Essencial + exames simples e especialistas', 149.90, 0),
 ('premium', 'Plano Premium', 'Conforto + exames de imagem e check-up anual', 249.90, 0),
 ('familia', 'Plano Família', 'Cobertura Premium para até 4 pessoas', 399.90, 3);

INSERT IGNORE INTO especialidades (codigo, nome, descricao) VALUES
 ('clinica-geral', 'Clínica geral', 'Atendimento clínico geral'),
 ('pediatria', 'Pediatria', 'Atendimento de crianças e adolescentes'),
 ('cardiologia', 'Cardiologia', 'Especialidade do sistema cardiovascular'),
 ('dermatologia', 'Dermatologia', 'Especialidade da pele, cabelos e unhas'),
 ('ginecologia', 'Ginecologia', 'Saúde ginecológica');

-- Não há usuário de demonstração pré-criado. Gere senha_hash no backend com bcrypt/Argon2.
-- A matrícula profissional 1001 e a senha caismed123 citadas no README do front são
-- apenas um mock local; não devem ser reutilizadas como credenciais reais.
-- Regras críticas (na API): validar CPF, autorizar perfis, validar associações profissional/
-- clínica/especialidade, impedir sobreposição de consultas com transação/lock e não marcar
-- fatura como paga sem confirmação confiável do meio de pagamento.
