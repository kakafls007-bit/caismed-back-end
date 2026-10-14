const router = require("express").Router();
const pool = require("../config/db");

router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT id, codigo, nome, descricao, valor_mensal, limite_dependentes FROM planos WHERE ativo = 1 ORDER BY valor_mensal"
    );
    res.json({ dados: rows });
  } catch (e) { console.error(e); res.status(500).json({ erro: "Erro ao consultar planos." }); }
});

module.exports = router;