/** Same mapping as lib/erlc/client.ts teamColor(), usable in the browser. */
export function teamColorClient(team: string) {
  switch (team.toLowerCase()) {
    case "police":
      return "#3987e5";
    case "sheriff":
      return "#9085e9";
    case "fire":
      return "#e66767";
    case "dot":
      return "#c98500";
    case "jail":
      return "#8a8a8a";
    default:
      return "#199e70";
  }
}
