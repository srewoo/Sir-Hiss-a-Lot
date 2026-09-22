// Self-check for the systems added on top of the base game: difficulty scaling,
// level-ups and the scale ward. Open the game, paste this whole file into the
// DevTools console, press Enter. Every line must say PASS.
//
// It drives window.__hiss (the debug hook at the bottom of game.js) and clears
// your saved stats as a side effect.
(() => {
  const H = window.__hiss, out = [];
  const ok = (name, cond, detail = '') =>
    out.push(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' :: ' + detail : ''}`);
  const play = () => document.getElementById('playBtn').click();

  localStorage.removeItem('hiss_stats');

  H.setDifficulty('easy'); play(); const easy = H.state();
  H.setDifficulty('hard'); play(); const hard = H.state();
  ok('hard is faster than easy', hard.speeds.cruise > easy.speeds.cruise,
     `${easy.speeds.cruise.toFixed(0)} -> ${hard.speeds.cruise.toFixed(0)} px/s`);
  ok('hard has more monoliths', hard.obstacles > easy.obstacles,
     `${easy.obstacles} -> ${hard.obstacles}`);

  H.setDifficulty('normal'); play(); H.feed('normal'); const nScore = H.state().score;
  H.setDifficulty('hard');   play(); H.feed('normal'); const hScore = H.state().score;
  ok('hard scores more per apple', hScore > nScore, `${nScore} vs ${hScore}`);

  H.setDifficulty('normal'); play();
  const rocks0 = H.state().obstacles;
  H.feed('normal', 5);
  ok('level 2 after 5 apples', H.state().level === 2, 'level=' + H.state().level);
  ok('level up adds a monolith', H.state().obstacles === rocks0 + 1,
     `${rocks0} -> ${H.state().obstacles}`);

  play(); H.feed('ward');
  ok('ward grants a charge', H.state().shieldCharges === 1);
  H.kill();
  ok('ward absorbs a fatal hit', !H.state().dead && H.state().shieldCharges === 0);
  ok('grace period starts', H.state().invuln > 0);
  H.kill();
  ok('invulnerable during grace', !H.state().dead);

  play(); H.kill();
  ok('dies with no ward left', H.state().dead);
  ok('run written to stats', JSON.parse(localStorage.getItem('hiss_stats')).games > 0);

  console.log(out.join('\n'));
  return out.every(l => l.startsWith('PASS')) ? 'ALL PASS' : 'FAILURES ABOVE';
})();
