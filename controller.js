"use strict";

/*
* controller.js
*
* Quoridor（クオリドル）ゲームのコントローラー（MVCパターンのC）を実装。
* ユーザー操作やAIとのやりとり、ゲーム進行管理、Undo/Redo、Web Worker連携などを担当。
*/

// Controllerクラス：ゲーム全体の制御を行う
class Controller {
    /**
     * Controllerクラスのコンストラクタ
     * @param {number} uctConst UCT定数（AI用）
     * @param {boolean} aiDevelopMode AI開発モードか
     */
    constructor(uctConst, aiDevelopMode = false) {
        this.aiDevelopMode = aiDevelopMode; // AI開発モードかどうか
        this.game = null; // 現在のゲームインスタンス
        this.gameHistory = null; // ゲーム履歴（Undo用）
        this.gameHistoryTrashCan = null;  // Redo用
        this.view = new View(this, this.aiDevelopMode); // Viewインスタンス
        this.worker = null; // Web Worker
        this.numOfMCTSSimulations = null; // MCTSのシミュレーション回数
        this.uctConst = uctConst; // UCT定数
    }

    /**
     * Web Workerを新規作成し、AI計算用に初期化
     */
    setNewWorker() {
        if (this.worker !== null) {
            this.worker.terminate();
        }
        this.worker = new Worker('worker.js');
    }

    /**
     * 新しいゲームを開始
     * @param {boolean} isHumanPlayerFirst 先手が人間か
     * @param {number} numOfMCTSSimulations AIのシミュレーション回数
     */
    startNewGame(isHumanPlayerFirst = true, numOfMCTSSimulations = 1000) {
        this.numOfMCTSSimulations = numOfMCTSSimulations;
        this.setNewWorker();
        let game = new Game(isHumanPlayerFirst);
        this.game = game;
        this.gameHistory = [];
        this.gameHistoryTrashCan = [];
        if (this.aiDevelopMode) {
            this.game.board.pawns[0].isHumanPlayer = true;
            this.game.board.pawns[1].isHumanPlayer = true;
        }
        this.gameHistory.push(Game.clone(this.game)); // 初期状態を履歴にpush
        this.view.game = this.game;
        this.view.render();
        if (this.aiDevelopMode) {
            this.renderDistancesForAIDevelopMode();
        }
        if (!this.aiDevelopMode && !isHumanPlayerFirst) {
            this.aiDo();
        }
        if (this.view && this.view.enableUndoRedoButtonIfNecessary) this.view.enableUndoRedoButtonIfNecessary();
    }

    /**
     * 指定した手を実行し、必要に応じてAIの手番も進める
     * @param {Object} move 手の内容
     */
    doMove(move) {
        const prevGame = Game.clone(this.game); // 直前の状態を保存
        const result = this.game.doMove(move, true);
        this.game.updateValidNextWalls(); // 壁合法性を毎回更新
        if (result) {
            this.gameHistory.push(Game.clone(this.game)); // move後の状態を履歴にpush
            this.gameHistoryTrashCan = [];
            this.view.render();
            if (this.aiDevelopMode) {
                this.renderDistancesForAIDevelopMode();
            }
            if (!this.game.pawnOfTurn.isHumanPlayer) {
                this.aiDo();
            }
        } else {
            this.view.printImpossibleWallMessage();
        }
        if (this.view && this.view.enableUndoRedoButtonIfNecessary) this.view.enableUndoRedoButtonIfNecessary();
    }

    /**
     * 一手戻す（Undo）
     */
    undo() {
        this.setNewWorker();
        if (this.view && this.view.adjustProgressBar) this.view.adjustProgressBar(0);
        if (!this.gameHistory || this.gameHistory.length <= 1) return; // 1手も戻せない場合は何もしない
        this.gameHistoryTrashCan.push(this.gameHistory.pop());
        this.game = Game.clone(this.gameHistory[this.gameHistory.length - 1]);
        this.view.game = this.game;
        this.view.render();
        if (this.view && this.view.enableUndoRedoButtonIfNecessary) this.view.enableUndoRedoButtonIfNecessary();
    }

    /**
     * 一手進める（Redo）
     */
    redo() {
        if (!this.gameHistoryTrashCan || this.gameHistoryTrashCan.length === 0) return;
        this.game = this.gameHistoryTrashCan.pop();
        this.gameHistory.push(Game.clone(this.game));
        this.view.game = this.game;
        this.view.render();
        if (this.view && this.view.enableUndoRedoButtonIfNecessary) this.view.enableUndoRedoButtonIfNecessary();
    }

    /**
     * AIに手を考えさせる
     */
    aiDo() {
        // Web Workerを使わず、直接AIを呼び出す
        const ai = new AI(this.numOfMCTSSimulations, this.uctConst, this.aiDevelopMode, false);
        const move = ai.chooseNextMove(Game.clone(this.game));
        this.doMove(move);
    }

    /**
     * AI開発モード用に、各位置までの最短距離を描画
     */
    renderDistancesForAIDevelopMode() {
        //this.view.render2DArrayToBoard(AI.getShortestDistanceToEveryPosition(this.game.pawnOfTurn, this.game));
    }    

    /**
     * MCTS候補手の勝率を表示する（MCTSボタン用）
     */
    showMCTSCandidates() {
        // プログレスバーを0%で表示
        if (this.view && this.view.adjustProgressBar) this.view.adjustProgressBar(0);
        // Web Workerを使ってMCTS進捗を表示
        if (this.worker !== null) {
            this.worker.terminate();
        }
        this.worker = new Worker('worker.js');
        // 進捗・結果受信
        this.worker.onmessage = (event) => {
            const data = event.data;
            console.log('Worker message:', data); // 進捗・候補・結果のログ出力
            if (typeof data === "number") {
                // 進捗（0～1）
                if (this.view && this.view.adjustProgressBar) this.view.adjustProgressBar(data * 100);
            } else if (data && data.type === 'candidates') {
                // 候補手リスト
                if (typeof window !== 'undefined') window.workerCandidates = data.candidates;
                if (this.view && this.view.renderInfoBox) this.view.renderInfoBox();
            } else {
                // 結果（move配列）
                if (this.view && this.view.adjustProgressBar) this.view.adjustProgressBar(100);
                if (this.view && this.view.renderInfoBox) this.view.renderInfoBox();
                this.worker.terminate();
                this.worker = null;
            }
        };
        this.worker.onerror = (error) => {
            if (this.view && this.view.adjustProgressBar) this.view.adjustProgressBar(0);
            this.worker.terminate();
            this.worker = null;
            alert('Worker error: ' + error.message);
        };
        // Workerに計算依頼
        this.worker.postMessage({
            game: Game.clone(this.game),
            numOfMCTSSimulations: this.numOfMCTSSimulations,
            uctConst: this.uctConst,
            aiDevelopMode: true
        });
        // 候補手リストを初期化
        if (typeof window !== 'undefined') window.workerCandidates = [];
        if (this.view && this.view.renderInfoBox) this.view.renderInfoBox();
    }
}


class AICompetition {
    constructor(isHumanPlayerFirstArrangement, numOfMCTSSimulations0, uctConst0, numOfMCTSSimulations1, uctConst1, numOfGamesToCompete = 50) {
        this.isHumanPlayerFirstArrangement = isHumanPlayerFirstArrangement;
        this.numOfGames = 0;
        this.numOfGamesToCompete = numOfGamesToCompete;
        this.ais = [
            {numOfMCTSSimulations: numOfMCTSSimulations0, uctConst: uctConst0, numWinsLight: 0, numWinsDark: 0},
            {numOfMCTSSimulations: numOfMCTSSimulations1, uctConst: uctConst1, numWinsLight: 0, numWinsDark: 0}
        ];
        this.game = null;
        this.gameHistory = []; // for view check this length propery...
        this.gameHistoryTrashCan = []; // for view check this length propery...
        this.view = new View(this, this.aiDevelopMode);
        this.worker = null;
        this.setNewWorker();
        this.startNewGame();
        this.view.htmlChooseAILevelMessageBox.classList.add("hidden");
    }

    setNewWorker() {
        if (this.worker !== null) {
            this.worker.terminate();
        }
        this.worker = new Worker('js/worker.js');
        const onMessageFunc = function(event) {
            const data = event.data;
            if (typeof(data) === "number") {
                this.view.adjustProgressBar(data * 100);
            } else {
                const move = data;
                this.doMove(move);
            }
        }
        this.worker.onmessage = onMessageFunc.bind(this);
        this.worker.onerror = function(error) {
            console.log('Worker error: ' + error.message + '\n');
            throw error;
        };
    }

    startNewGame() {
        let game = new Game(this.isHumanPlayerFirstArrangement);
        this.game = game;
        this.game.board.pawns[0].isHumanPlayer = true;
        this.game.board.pawns[1].isHumanPlayer = true;
        this.view.game = this.game;
        this.view.render();
        console.log("Game start!")
        const ai_light = this.ais[this.numOfGames%2];
        console.log(ai_light.numOfMCTSSimulations, ai_light.uctConst, "is light-colored pawn!");
        this.aiDo();
    }

    doMove(move) {
        if (this.game.doMove(move, true)) {
            this.view.render();
            if (this.game.winner === null) {
                this.aiDo();
            } else { // game ended.
                if (this.game.winner.index === 0) {
                    this.ais[(this.numOfGames % 2)].numWinsLight++;
                } else {
                    this.ais[((this.numOfGames + 1) % 2)].numWinsDark++;
                }
                this.numOfGames++;
                console.log("Game ended! Here the statistics following...")
                console.log("Number of total games:", this.numOfGames);
                console.log(this.ais[0].numOfMCTSSimulations, this.ais[0].uctConst, "numWinsLight:", this.ais[0].numWinsLight, "numWinsDark", this.ais[0].numWinsDark);
                console.log(this.ais[1].numOfMCTSSimulations, this.ais[1].uctConst, "numWinsLight:", this.ais[1].numWinsLight, "numWinsDark", this.ais[1].numWinsDark);
                if (this.numOfGames < this.numOfGamesToCompete) {
                    this.startNewGame();
                } else {
                    console.log("Competition Ended.");
                }
            }
        } else {
            // suppose that pawnMove can not be return false, if make the View perfect.
            // so if doMove return false, it's from placeWalls.
            this.view.printImpossibleWallMessage();
        }
    }

    aiDo() {
        const index = (this.numOfGames + this.game.turn) % 2 
        this.worker.postMessage({game: this.game, numOfMCTSSimulations: this.ais[index].numOfMCTSSimulations, uctConst: this.ais[index].uctConst, aiDevelopMode: false});
    }
}


