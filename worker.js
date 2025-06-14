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

onmessage = function(event) {
    // メインスレッドからゲーム状態・AI設定を受信
    const game = Game.clone(event.data.game);
    if (game.winner === null) {
        // AIで次の手を探索し、進捗・候補・結果を返す
        const ai = new AI(event.data.numOfMCTSSimulations, event.data.uctConst, event.data.aiDevelopMode, true);
        // chooseNextMove内で進捗・候補・結果をpostMessageする
        const move = ai.chooseNextMove(game);
        // 最終手も一応返す（後方互換）
        postMessage(move);
    }
};

