// Conteúdo do jogo em JSON (edite os .json; nenhum código precisa mudar para ajustar textos e números).
//  - challenges.json  dados dos desafios extraídos do FieldTestLab (fieldtestlab-delta.vercel.app, data/desafio-*.json)
//  - content.json     preparação do laboratório e perguntas do relatório por desafio.
//                     Em cada pergunta a opção correta é SEMPRE a primeira; o jogo embaralha a ordem na tela.
//  - equipment.json   itens do armário
//  - avatars.json     uniformes da loja (desenhados em ui/avatarSvg.js)
//  - network.json     operadoras, bandas, sites (RRUs padrão), células exigidas por desafio e unidades dos racks RAN
//  - cores.json       racks de núcleo por tipo de site (IMS, EPC + IMS, BSC/MSC) e fluxos de sinalização (SIP, attach, SRVCC)
//  - benchOps.json    passos de bancada por desafio (when/unless/match testam o rótulo do cenário; {1} {2} vêm do match)
import challenges from "./challenges.json";
import content from "./content.json";
import equipment from "./equipment.json";
import avatars from "./avatars.json";
import network from "./network.json";
import cores from "./cores.json";
import benchOps from "./benchOps.json";

export const CHALLENGE_DATA = challenges;
export const CONTENT = content;
export const EQUIPMENT = equipment;
export const AVATARS = avatars;
export const NETWORK = network;
export const CORES = cores;
export const BENCH_OPS = benchOps;
