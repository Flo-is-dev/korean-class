import { shuffle } from '../lib/cards';
import type { Card, QuizResult } from '../types';

export function ResultPage({ result, reward, onRetry, onLearn, onScores }: {
  result: QuizResult; reward: string; onRetry: (cards: Card[]) => void; onLearn: () => void; onScores: () => void;
}) {
  const good = result.answers.filter(answer => answer.ok).length;
  const missed = result.answers.filter(answer => !answer.ok);
  const percentage = result.answers.length ? Math.round(good / result.answers.length * 100) : 0;
  return <section className="panel"><h2>{!result.completed ? 'Série interrompue' : result.run.timed ? 'Défi chrono terminé !' : 'Bien joué, continue comme ça !'}</h2><p className="reward">{reward}</p>
    <div className="score"><span className="big">{good}/{result.answers.length}</span><span className="of">{percentage} % de bonnes réponses</span></div>
    {result.run.timed && <button className="btn" onClick={onScores}>Voir mes records</button>}
    {missed.length ? <div className="field"><div className="label">À revoir ({missed.length})</div><ul className="missed">{missed.map(answer => <li key={answer.card.id}><span className="m-fr">{answer.card.front}</span><span className="m-ko" lang="ko">{answer.card.back}</span></li>)}</ul></div> : <p className="empty-state">{result.answers.length ? 'Aucune erreur sur les cartes répondues.' : 'Aucune réponse enregistrée.'}</p>}
    <div className="row">{missed.length > 0 && <button className="btn primary" onClick={() => onRetry(shuffle(missed.map(answer => answer.card)))}>Refaire les ratés</button>}<button className={`btn ${missed.length ? '' : 'primary'}`} onClick={onLearn}>Nouveau quiz</button></div>
  </section>;
}
