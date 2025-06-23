"use strict";

/*
* worker.js
*
* Web Workerスレッドで動作するAI計算用スクリプト。
* メインスレッドのUI応答性を保つため、AIの重い計算処理をバックグラウンドで実行。
* ゲーム状態を受け取り、AIで次の手を計算し、結果をメインスレッドに返す。
*/

importScripts('game.js'); // ゲームロジック
importScripts('ai.js');   // AIロジック

let mctsCache = {}; // 不要だが念のため残す
let globalAI = null;

function reviveGamePrototypes(game) {
    if (!game) return;
    Object.setPrototypeOf(game, Game.prototype);
    if (game.board) {
        Object.setPrototypeOf(game.board, Board.prototype);
        if (game.board.pawns) {
            for (let i = 0; i < game.board.pawns.length; i++) {
                Object.setPrototypeOf(game.board.pawns[i], Pawn.prototype);
                if (game.board.pawns[i].position) {
                    Object.setPrototypeOf(game.board.pawns[i].position, PawnPosition.prototype);
                }
            }
        }
    }
}

onmessage = function(event) {
    const game = event.data.game;
    reviveGamePrototypes(game);
    const updateInterval = event.data.updateInterval || 1000;
    if (game.winner === null) {
        // グローバルAIインスタンスを使い回す
        if (!globalAI) {
            globalAI = new AI(event.data.numOfMCTSSimulations, event.data.uctConst, event.data.aiDevelopMode, true);
        } else {
            // パラメータが変わった場合は再生成
            if (globalAI.numOfMCTSSimulations !== event.data.numOfMCTSSimulations || globalAI.uctConst !== event.data.uctConst) {
                globalAI = new AI(event.data.numOfMCTSSimulations, event.data.uctConst, event.data.aiDevelopMode, true);
            }
        }
        const move = globalAI.chooseNextMove(game, false, updateInterval);
        postMessage(move);
    }
};

