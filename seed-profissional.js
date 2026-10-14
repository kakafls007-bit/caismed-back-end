require("dotenv").config();
const bcrypt = require("bcryptjs");
const pool = require("../src/config/db");

(async () => {
  const conn = await pool.getConnection();
  try {
    const matricula = process.env.SEED_PROF_MATRICULA || "1001";
    const nome = process.env.SEED_PROF_NOME || "Profissional Demonstração";
    const senha = process.env.SEED_PROF_SENHA;
    if (!senha || senha.length < 8) {
      console.error("Defina SEED_PROF_SENHA com pelo menos 8 caracteres no ambiente antes de executar.");
      process.exitCode = 1;
      return;
    }
    const hash = await bcrypt.hash(senha, 12);
    await conn.beginTransaction();
    const [existente] = await conn.execute("SELECT id, usuario_id FROM profissionais WHERE matricula = ?", [matricula]);
    if (existente[0]) {
      console.log("Já existe profissional com essa matrícula; nenhum dado alterado.");
      await conn.rollback();
      return;
    }
    const [u] = await conn.execute(
      "INSERT INTO usuarios (nome, senha_hash, perfil, ativo) VALUES (?, ?, 'PROFISSIONAL', 1)",
      [nome, hash]
    );
    await conn.execute(
      "INSERT INTO profissionais (usuario_id, matricula) VALUES (?, ?)",
      [u.insertId, matricula]
    );
    await conn.commit();
    console.log(`Profissional ${matricula} criado. Guarde a senha com segurança.`);
  } catch (e) {
    await conn.rollback();
    console.error(e);
    process.exitCode = 1;
  } finally {
    conn.release();
    await pool.end();
  }
})();