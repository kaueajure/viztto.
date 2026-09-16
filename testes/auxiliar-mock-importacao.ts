import { vi } from "vitest";

export function respostaJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function mockTransfermarktBrasil() {
  return vi.fn().mockImplementation(async (entrada: string | URL | Request) => {
    const url =
      typeof entrada === "string"
        ? entrada
        : entrada instanceof URL
          ? entrada.href
          : entrada.url;

    if (url.includes("/competitions/search/")) {
      return respostaJson({
        query: "Brasileirão",
        pageNumber: 1,
        lastPageNumber: 1,
        results: [
          {
            id: "BRA1",
            name: "Campeonato Brasileiro Série A",
            country: "Brazil",
            clubs: 20,
            players: 600,
          },
        ],
      });
    }

    if (url.includes("/competitions/BRA1/clubs")) {
      return respostaJson({
        id: "BRA1",
        name: "Campeonato Brasileiro Série A",
        seasonId: "2026",
        clubs: [
          { id: "614", name: "CR Flamengo" },
          { id: "1023", name: "SE Palmeiras" },
          { id: "199", name: "SC Corinthians" },
        ],
      });
    }

    const perfil = (id: string, nome: string, estadio: string) =>
      respostaJson({
        id,
        url: `/clube/${id}`,
        name: nome,
        officialName: nome,
        image: `https://tmssl.akamaized.net/${id}.png`,
        foundedOn: "1912-01-01",
        stadiumName: estadio,
        stadiumSeats: 78000,
        currentTransferRecord: -5_000_000,
        currentMarketValue: 180_000_000,
        squad: {
          size: 2,
          averageAge: 26.5,
          foreigners: 4,
          nationalTeamPlayers: 8,
        },
        league: {
          id: "BRA1",
          name: "Série A",
          countryName: "Brazil",
        },
      });

    if (url.includes("/clubs/614/profile"))
      return perfil("614", "CR Flamengo", "Maracanã");
    if (url.includes("/clubs/1023/profile"))
      return perfil("1023", "SE Palmeiras", "Allianz Parque");
    if (url.includes("/clubs/199/profile"))
      return perfil("199", "SC Corinthians", "Neo Química Arena");

    if (url.includes("/clubs/614/players")) {
      return respostaJson({
        id: "614",
        players: [
          {
            id: "1",
            name: "Goleiro A",
            position: "Goalkeeper",
            age: 30,
            nationality: ["Brazil"],
            marketValue: 5_000_000,
            contract: "2027-12-31",
          },
          {
            id: "2",
            name: "Zagueiro A",
            position: "Centre-Back",
            age: 28,
            nationality: ["Brazil"],
            marketValue: 8_000_000,
          },
          {
            id: "3",
            name: "Zagueiro B",
            position: "Centre-Back",
            age: 26,
            nationality: ["Brazil"],
            marketValue: 7_000_000,
          },
          {
            id: "4",
            name: "Lateral D",
            position: "Right-Back",
            age: 24,
            nationality: ["Brazil"],
            marketValue: 6_000_000,
          },
          {
            id: "5",
            name: "Lateral E",
            position: "Left-Back",
            age: 25,
            nationality: ["Brazil"],
            marketValue: 6_000_000,
          },
          {
            id: "6",
            name: "Volante A",
            position: "Defensive Midfield",
            age: 27,
            nationality: ["Brazil"],
            marketValue: 10_000_000,
          },
          {
            id: "7",
            name: "Meia A",
            position: "Central Midfield",
            age: 23,
            nationality: ["Brazil"],
            marketValue: 12_000_000,
          },
          {
            id: "8",
            name: "Meia B",
            position: "Central Midfield",
            age: 22,
            nationality: ["Brazil"],
            marketValue: 9_000_000,
          },
          {
            id: "9",
            name: "Ponta E",
            position: "Left Winger",
            age: 24,
            nationality: ["Brazil"],
            marketValue: 15_000_000,
          },
          {
            id: "10",
            name: "Ponta D",
            position: "Right Winger",
            age: 21,
            nationality: ["Brazil"],
            marketValue: 14_000_000,
          },
          {
            id: "11",
            name: "Centroavante",
            position: "Centre-Forward",
            age: 29,
            nationality: ["Brazil"],
            marketValue: 20_000_000,
          },
        ],
      });
    }

    if (url.includes("/clubs/1023/players")) {
      return respostaJson({
        id: "1023",
        players: [
          {
            id: "101",
            name: "Goleiro P",
            position: "Goalkeeper",
            age: 31,
            nationality: ["Brazil"],
            marketValue: 4_000_000,
          },
          {
            id: "102",
            name: "Atacante P",
            position: "Centre-Forward",
            age: 27,
            nationality: ["Brazil"],
            marketValue: 18_000_000,
          },
        ],
      });
    }

    if (url.includes("/clubs/199/players")) {
      return respostaJson({
        id: "199",
        players: [
          {
            id: "201",
            name: "Goleiro C",
            position: "Goalkeeper",
            age: 29,
            nationality: ["Brazil"],
            marketValue: 3_000_000,
          },
          {
            id: "202",
            name: "Meia C",
            position: "Attacking Midfield",
            age: 25,
            nationality: ["Brazil"],
            marketValue: 11_000_000,
          },
        ],
      });
    }

    throw new Error(`Fetch não mockado: ${url}`);
  });
}
