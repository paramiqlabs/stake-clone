import Link from "next/link";

export function GamesList({ games }) {
  if (!games?.length) {
    return <p>No games available.</p>;
  }

  return (
    <ul>
      {games.map((game) => (
        <li key={game.id}>
          <h3>{game.name}</h3>
          <p>Provider: {game.provider}</p>
          <Link href={`/game/${game.slug}`}>Open</Link>
        </li>
      ))}
    </ul>
  );
}

