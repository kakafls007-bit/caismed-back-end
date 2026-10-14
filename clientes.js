const router = require("express").Router();
const bcrypt = require("bcryptjs");
const pool = require("../config/db");
const { autenticar, permitir } = require("../middleware/auth");

const digitos = (v) => String(v || "").replace(/\D/g, "");
const validarCpfFormato = (cpf) => digitos(cpf).length === 11;

router.use(autenticar);

// Cadastro de paciente feito por profissional ou administrador.
router.post("/", permitir("PROFISSIONAL", "ADMIN"), async (req, res) => {
  const { nome, cpf, nascimento, telefone, email, cidade, plano, planoId } = req.body;
  const cpfLimpo = digitos(cpf);
  if (!nome || !validarCpfFormato(cpf) || !nome.trim()) {
    return res.status(400).json({ erro: "Nome e CPF com 11 dígitos são obrigatórios." });
  }
  try {
    const [planos] = await pool.execute("SELECT id FROM planos WHERE (codigo = ? OR id = ?) AND ativo = 1 LIMIT 1",
      [String(plano || planoId || ""), Number(planoId || 0)]);
    const planoEncontrado = planos[0];
    if (!planoEncontrado) return res.status(400).json({ erro: "Selecione um plano válido." });

    const [result] = await pool.execute(
      `INSERT INTO pacientes (nome, cpf, data_nascimento, telefone, email, cidade, plano_id, criado_por_usuario_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [nome.trim(), cpfLimpo, nascimento || null, telefone || null, email || null, cidade || null, planoEncontrado.id, Number(req.usuario.sub)]
    );
    const [rows] = await pool.execute(
      `SELECT p.id, p.nome, p.cpf, p.data_nascimento AS nascimento, p.telefone, p.email, p.cidade,
              p.plano_id AS planoId, pl.codigo AS plano, p.primeiro_acesso_concluido
       FROM pacientes p LEFT JOIN planos pl ON pl.id = p.plano_id WHERE p.id = ?`,
      [result.insertId]
    );
    res.status(201).json({ mensagem: "Paciente cadastrado.", cliente: rows[0] });
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY") return res.status(409).json({ erro: "Já existe paciente cadastrado com este CPF." });
    console.error(e); res.status(500).json({ erro: "Erro ao cadastrar paciente." });
  }
});

router.get("/", permitir("PROFISSIONAL", "ADMIN"), async (req, res) => {
  try {
    const termo = String(req.query.busca || "").trim();
    const [rows] = await pool.execute(
      `SELECT p.id, p.nome, p.cpf, p.data_nascimento AS nascimento, p.telefone, p.email, p.cidade,
              p.plano_id AS planoId, pl.codigo AS plano, p.primeiro_acesso_concluido
       FROM pacientes p LEFT JOIN planos pl ON pl.id = p.plano_id
       WHERE (? = '' OR p.nome LIKE CONCAT('%', ?, '%') OR p.cpf LIKE CONCAT('%', ?, '%'))
       ORDER BY p.nome LIMIT 200`,
      [termo, termo, termo]
    );
    res.json({ dados: rows });
  } catch (e) { console.error(e); res.status(500).json({ erro: "Erro ao listar pacientes." }); }
});

router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const proprioPaciente = req.usuario.perfil === "PACIENTE" && Number(req.usuario.referenciaId) === id;
  if (!proprioPaciente && !["PROFISSIONAL", "ADMIN"].includes(req.usuario.perfil)) {
    return res.status(403).json({ erro: "Sem permissão para consultar este paciente." });
  }
  try {
    const [rows] = await pool.execute(
      `SELECT p.id, p.nome, p.cpf, p.data_nascimento AS nascimento, p.telefone, p.email, p.cidade,
              p.plano_id AS planoId, pl.codigo AS plano
       FROM pacientes p LEFT JOIN planos pl ON pl.id = p.plano_id WHERE p.id = ?`,
      [id]
    );
    if (!rows[0]) return res.status(404).json({ erro: "Paciente não encontrado." });
    res.json({ cliente: rows[0] });
  } catch (e) { console.error(e); res.status(500).json({ erro: "Erro ao consultar paciente." }); }
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const proprioPaciente = req.usuario.perfil === "PACIENTE" && Number(req.usuario.referenciaId) === id;
  if (!proprioPaciente && !["PROFISSIONAL", "ADMIN"].includes(req.usuario.perfil)) {
    return res.status(403).json({ erro: "Sem permissão para alterar este paciente." });
  }
  const { nome, telefone, email, cidade, plano, planoId, nascimento } = req.body;
  try {
    let idPlano = null;
    if (plano || planoId) {
      const [p] = await pool.execute("SELECT id FROM planos WHERE (codigo = ? OR id = ?) AND ativo = 1 LIMIT 1",
        [String(plano || planoId || ""), Number(planoId || 0)]);
      if (!p[0]) return res.status(400).json({ erro: "Plano inválido." });
      idPlano = p[0].id;
    }
    const campos = [];
    const valores = [];
    if (nome !== undefined) { campos.push("nome = ?"); valores.push(String(nome).trim()); }
    if (telefone !== undefined) { campos.push("telefone = ?"); valores.push(telefone || null); }
    if (email !== undefined) { campos.push("email = ?"); valores.push(email || null); }
    if (cidade !== undefined) { campos.push("cidade = ?"); valores.push(cidade || null); }
    if (nascimento !== undefined) { campos.push("data_nascimento = ?"); valores.push(nascimento || null); }
    if (idPlano !== null && ["PROFISSIONAL", "ADMIN"].includes(req.usuario.perfil)) { campos.push("plano_id = ?"); valores.push(idPlano); }
    if (!campos.length) return res.status(400).json({ erro: "Nenhum campo permitido informado." });
    valores.push(id);
    const [result] = await pool.execute(`UPDATE pacientes SET ${campos.join(", ")} WHERE id = ?`, valores);
    if (!result.affectedRows) return res.status(404).json({ erro: "Paciente não encontrado." });
    const [rows] = await pool.execute(
      `SELECT p.id, p.nome, p.cpf, p.data_nascimento AS nascimento, p.telefone, p.email, p.cidade,
              p.plano_id AS planoId, pl.codigo AS plano FROM pacientes p
       LEFT JOIN planos pl ON pl.id = p.plano_id WHERE p.id = ?`, [id]);
    res.json({ mensagem: "Cadastro atualizado.", cliente: rows[0] });
  } catch (e) { console.error(e); res.status(500).json({ erro: "Erro ao atualizar paciente." }); }
});

router.get("/:id/faturas", async (req, res) => {
  const id = Number(req.params.id);
  if (req.usuario.perfil === "PACIENTE" && Number(req.usuario.referenciaId) !== id) {
    return res.status(403).json({ erro: "Sem permissão para consultar estas faturas." });
  }
  if (!["PACIENTE", "PROFISSIONAL", "ADMIN"].includes(req.usuario.perfil)) return res.status(403).json({ erro: "Sem permissão." });
  try {
    const [rows] = await pool.execute(
      `SELECT f.id, f.competencia, f.valor, f.vencimento, f.status, pl.nome AS plano
       FROM faturas f JOIN planos pl ON pl.id = f.plano_id
       WHERE f.paciente_id = ? ORDER BY f.competencia DESC LIMIT 24`, [id]);
    res.json({ dados: rows });
  } catch (e) { console.error(e); res.status(500).json({ erro: "Erro ao consultar faturas." }); }
});

module.exports = router;