# License scope

[中文](LICENSE-SCOPE.md) · [English](LICENSE-SCOPE.en.md)

## Software and interface

The [MIT License](LICENSE) applies to the original workbench code and UI owned by JessToX, including the engine implementation, storage and export code, simulation and model interfaces, interactive components, project styles, and synthetic test code. It also covers the confirmed original geometric interface assets at `public/illustrations/seats/seat-{0,1,2,3}-{ready,paused}.png` and `public/favicon.png`. The copyright notice is `Copyright (c) 2026 JessToX`.

## Animal character artwork

This game includes ready and paused portraits for ten animal characters. You may run Critter Quest and display the characters during normal play without an additional fee or contacting the author. The software MIT license and the game content license do not cover the character artwork or designs. Any other use requires prior authorization from JessToX. These terms preserve uses permitted by applicable law or the [GitHub Terms of Service, section D.5](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service#5-license-grant-to-other-users), including viewing and forking a public repository on GitHub. [Character artwork terms and file list](docs/licenses/character-artwork.md)

## Game content

Anyone may use, copy, share, and adapt original V7.1 game content in which JessToX holds rights for noncommercial purposes. For commercial use, obtain separate permission from JessToX where applicable law requires it. The game content permission covers the original expression identified below and copies of that expression. The software and UI implementation are available under MIT, including for commercial use. Applicable law governs abstract ideas, methods of play, and purely functional rules. See the [full game content permission](GAME-CONTENT-LICENSE.md).

| File or material                                                                                                                                   | Game content and software implementation                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [rules/v71-final-text.ts](rules/v71-final-text.ts)                                                                                                 | In `V71_FINAL_DOCUMENT`, the official player rules in sections 01–13, the production lists in sections 14–16, and the deck, card, and order expression they contain are game content. The export statements are part of the software interface.         |
| [rules/compiled/final-v7.1.json](rules/compiled/final-v7.1.json)                                                                                   | Game expression in `text` and `config`, and the rule revision notes, are game content. IDs, hashes, and timestamps identify the version.                                                                                                                |
| [lib/game/engines/v71/cards.ts](lib/game/engines/v71/cards.ts)                                                                                     | `V71_CONFIG`, the order combinations in `createOrders`, and the main deck definitions in `createMainCards` fall under game data. ID generation, object construction, shuffling, drawing, and replenishment are engine implementation.                   |
| [lib/game/engines/v71/setup.ts](lib/game/engines/v71/setup.ts), [lib/game/market.ts](lib/game/market.ts), [lib/game/labels.ts](lib/game/labels.ts) | Fixed starting configurations, food and event card definitions, card names and associated game text, and price settings fall under game data or expression. Validation, state initialization, queries, and label rendering are software implementation. |
| [lib/game/registry.ts](lib/game/registry.ts), [lib/rules/versions.ts](lib/rules/versions.ts)                                                       | `ruleSummary`, `V71_IMPLEMENTATION_NOTES`, and the rule text and revision notes carried by `BASE_RULE` are game content. Registration, lookup, import, and presentation are software implementation.                                                    |
| Other copies of game expression                                                                                                                    | References that reproduce the text, complete configurations, or decks in the UI, engine, prompts, tests, saved snapshots, or exports retain the scope of the underlying content. Runtime rendering, validation, and serialization are software.         |

The original Word and PDF files, older rules, original seat illustrations, and historical playtest materials are kept internally. This package contains the official V7.1 materials and the source files needed to run them.

## Third-party material

Third-party material retains its upstream notices. Original changes made by the project to upstream templates are covered by the project’s software license. See the [third-party notices](docs/THIRD_PARTY.en.md) for upstream templates, fonts, icons, and dependencies.
