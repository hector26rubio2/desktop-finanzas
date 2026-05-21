function buildChain(handlers) {
  return (req, res, next) => {
    let index = 0;
    function run(i) {
      if (i >= handlers.length) return next();
      handlers[i].handle(req, res, () => run(i + 1));
    }
    run(index);
  };
}

module.exports = { buildChain };
