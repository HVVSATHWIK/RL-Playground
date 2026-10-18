import { FightClub } from './features/fight-club/FightClub';

export default function App() {
  return (
    <div className="h-screen flex flex-col bg-slate-50 text-slate-800">
      <main className="flex-1 overflow-hidden bg-slate-50">
        <FightClub />
      </main>
    </div>
  );
}
