const router = require("express").Router();
const pool = require("../config/db");
const { autenticar, permitir } = require("../middleware/auth");
router.use(autenticar);

router.get("/", async (req, res) => {
  try {
    let sql = `SELECT c.id, c.paciente_id AS pacienteId, p.nome AS paciente,
      c.profissional_id AS profissionalId, c.clinica_id AS clinicaId,
      c.especialidade_id AS especialidadeId, e.nome AS especialidade,
      c.inicio, c.fim, c.status, c.observacao_paciente AS observacao,
      c.cancelada_em AS canceladaEm, c.motivo_cancelamento AS motivoCancelamento
      FROM consultas c JOIN pacientes p ON p.id = c.paciente_id
      JOIN especialidades e ON e.id = c.especialidade_id`;
    const params = [];
    if (req.usuario.perfil === "PACIENTE") {
      sql += " WHERE c.paciente_id = ?";
      params.push(Number(req.usuario.referenciaId));
    } else if (req.usuario.perfil === "PROFISSIONAL") {
      sql += " WHERE c.profissional_id = ?";
      params.push(Number(req.usuario.referenciaId));
    } else if (req.usuario.perfil !== "ADMIN") {
      return res.status(403).json({ erro: "Sem permissão." });
    }
    sql += " ORDER BY c.inicio IS NULL, c.inicio DESC LIMIT 300";
    const [rows] = await pool.execute(sql, params);
    res.json({ dados: rows });
  } catch (e) { console.error(e); res.status(500).json({ erro: "Erro ao consultar agendamentos." }); }
});

router.post("/", permitir("PACIENTE", "PROFISSIONAL", "ADMIN"), async (req, res) => {
  const pacienteId = req.usuario.perfil === "PACIENTE" ? Number(req.usuario.referenciaId) : Number(req.body.pacienteId);
  const especialidadeId = Number(req.body.especialidadeId);
  const profissionalId = req.body.profissionalId ? Number(req.body.profissionalId) : null;
  const clinicaId = req.body.clinicaId ? Number(req.body.clinicaId) : null;
  const inicio = req.body.inicio || null;
  const fim = req.body.fim || null;
  const status = inicio ? "AGENDADA" : "PENDENTE_AGENDAMENTO";

  if (!pacienteId || !especialidadeId) return res.status(400).json({ erro: "Paciente e especialidade são obrigatórios." });
  if (inicio && !fim) return res.status(400).json({ erro: "Informe início e fim da consulta." });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [pacientes] = await conn.execute("SELECT id FROM pacientes WHERE id = ? AND ativo = 1", [pacienteId]);
    const [especialidades] = await conn.execute("SELECT id FROM especialidades WHERE id = ? AND ativa = 1", [especialidadeId]);
    if (!pacientes[0] || !especialidades[0]) { await conn.rollback(); return res.status(400).json({ erro: "Paciente ou especialidade inválidos." }); }

    if (profissionalId && clinicaId) {
      const [vinculos] = await conn.execute(
        "SELECT 1 FROM profissional_clinicas WHERE profissional_id = ? AND clinica_id = ? AND ativo = 1",
        [profissionalId, clinicaId]);
      if (!vinculos[0]) { await conn.rollback(); return res.status(400).json({ erro: "Profissional não está associado à clínica informada." }); }
    }

    if (inicio && profissionalId) {
      const [conflitos] = await conn.execute(
        `SELECT id FROM consultas WHERE profissional_id = ? AND status IN ('AGENDADA','CONFIRMADA')
         AND inicio < ? AND fim > ? FOR UPDATE`,
        [profissionalId, fim, inicio]);
      if (conflitos.length) { await conn.rollback(); return res.status(409).json({ erro: "Este horário não está mais disponível." }); }
    }
    const [result] = await conn.execute(
      `INSERT INTO consultas (paciente_id, profissional_id, clinica_id, especialidade_id, inicio, fim, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [pacienteId, profissionalId, clinicaId, especialidadeId, inicio, fim, status]);
    await conn.commit();
    res.status(201).json({ mensagem: "Consulta registrada.", consulta: { id: result.insertId, pacienteId, profissionalId, clinicaId, especialidadeId, inicio, fim, status } });
  } catch (e) {
    await conn.rollback();
    console.error(e);
    res.status(500).json({ erro: "Erro ao registrar consulta." });
  } finally { conn.release(); }
});

router.patch("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { status, inicio, fim, motivoCancelamento } = req.body;
  const permitidos = ["AGENDADA", "CONFIRMADA", "CANCELADA", "REALIZADA", "FALTOU"];
  if (!status || !permitidos.includes(status)) return res.status(400).json({ erro: "Status inválido." });
  try {
    const [rows] = await pool.execute("SELECT id, paciente_id, profissional_id, status FROM consultas WHERE id = ?", [id]);
    const c = rows[0];
    if (!c) return res.status(404).json({ erro: "Consulta não encontrada." });
    const dono = req.usuario.perfil === "PACIENTE" && Number(req.usuario.referenciaId) === c.paciente_id;
    const profissionalResponsavel = req.usuario.perfil === "PROFISSIONAL" && Number(req.usuario.referenciaId) === c.profissional_id;
    if (!dono && !profissionalResponsavel && req.usuario.perfil !== "ADMIN") {
      return res.status(403).json({ erro: "Sem permissão para alterar esta consulta." });
    }
    if (status === "REALIZADA" || status === "FALTOU" || status === "CONFIRMADA") {
      if (!profissionalResponsavel && req.usuario.perfil !== "ADMIN") return res.status(403).json({ erro: "Somente o profissional responsável pode atualizar este status." });
    }
    if (status === "CANCELADA" && !["AGENDADA", "CONFIRMADA", "PENDENTE_AGENDAMENTO"].includes(c.status)) {
      return res.status(409).json({ erro: "Esta consulta não pode ser cancelada neste estado." });
    }
    const novoInicio = inicio || null;
    const novoFim = fim || null;
    if (status === "AGENDADA" && (!novoInicio || !novoFim)) return res.status(400).json({ erro: "Informe início e fim ao agendar." });

    await pool.execute(
      `UPDATE consultas SET status = ?, inicio = COALESCE(?, inicio), fim = COALESCE(?, fim),
       cancelada_em = CASE WHEN ? = 'CANCELADA' THEN NOW() ELSE cancelada_em END,
       motivo_cancelamento = CASE WHEN ? = 'CANCELADA' THEN ? ELSE motivo_cancelamento END
       WHERE id = ?`,
      [status, novoInicio, novoFim, status, status, motivoCancelamento || null, id]);
    res.json({ mensagem: "Consulta atualizada.", id, status });
  } catch (e) { console.error(e); res.status(500).json({ erro: "Erro ao atualizar consulta." }); }
});

module.exports = router;