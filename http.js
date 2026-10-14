function erroInterno(res, erro) {
  console.error(erro);
  return res.status(500).json({ erro: "Erro interno. Tente novamente." });
}
module.exports = { erroInterno };