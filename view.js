"use strict";

/*
* View part in the MVC pattern
* 
* Quoridorのビュー（画面表示・UI操作）を担当。
* 盤面描画、ユーザー入力、ダイアログ制御、AIレベル選択などを管理。
*/

const cellSize = 48;
const wallSize = 12;

class View {
    /**
     * Viewクラスのコンストラクタ
     * @param {Controller} controller コントローラへの参照
     * @param {boolean} aiDevelopMode AI開発モードか
     */
    constructor(controller, aiDevelopMode = false) {
        this.controller = controller;
        this.aiDevelopMode = aiDevelopMode;

        this._game = null;
        this.progressBarIntervalId = null;
        this.aiLevel = null;
        this.numOfMCTSSimulations = null;

        this.htmlBoardTable = document.getElementById("board_table");
        this.htmlPawns = [document.getElementById("pawn0"), document.getElementById("pawn1")];
        // this.htmlMessageBox = document.getElementById("message_box"); // message_box削除のため無効化
        
        this.htmlAboutBox = document.getElementById("about_box");
        this.htmlChooseAILevelMessageBox = document.getElementById("choose_ai_level_message_box");
        this.htmlChoosePawnMessageBox = document.getElementById("choose_pawn_message_box");
        this.htmlRestartMessageBox = document.getElementById("restart_message_box");
        this.htmlInfoBox = document.getElementById("info_box");


        // --- イベントハンドラ関数を先に定義 ---
        const onclickUndoButton = function(e) {
            // ボタンのdisable制御を削除
            View.removePreviousFadeInoutBox();
            View.cancelPawnClick();
            View.cancelWallShadows();
            this.controller.undo();
        };
        const onclickRedoButton = function(e) {
            // ボタンのdisable制御を削除
            View.cancelPawnClick();
            View.cancelWallShadows();
            this.controller.redo();
        };
        const onclickRestartButton = function(e) {
            if (this.button.undo) this.button.undo.disabled = true;
            if (this.button.redo) this.button.redo.disabled = true;
            if (this.button.aiDo) this.button.aiDo.disabled = true;
            View.removePreviousFadeInoutBox();
            if (this.htmlAboutBox) this.htmlAboutBox.classList.add("hidden");
            if (this.htmlChoosePawnMessageBox) this.htmlChoosePawnMessageBox.classList.add("hidden");
            if (this.htmlChooseAILevelMessageBox) this.htmlChooseAILevelMessageBox.classList.add("hidden");
            if (this.htmlRestartMessageBox) this.htmlRestartMessageBox.classList.remove("hidden");
        };
        const onclickAboutButton = function(e) {
            if (this.htmlAboutBox && this.htmlAboutBox.classList.contains("hidden")) {
                if (this.button.undo) this.button.undo.disabled = true;
                if (this.button.redo) this.button.redo.disabled = true;
                View.removePreviousFadeInoutBox();
                if (this.htmlRestartMessageBox) this.htmlRestartMessageBox.classList.add("hidden");
                if (this.htmlChooseAILevelMessageBox) this.htmlChooseAILevelMessageBox.classList.add("hidden");
                if (this.htmlChoosePawnMessageBox) this.htmlChoosePawnMessageBox.classList.add("hidden");
                this.htmlAboutBox.classList.remove("hidden");
            } else if (this.htmlAboutBox) {
                this.htmlAboutBox.classList.add("hidden");
                this.enableUndoRedoButtonIfNecessary();
            }
        };
        // --- ボタン取得・イベント登録 ---
        this.button = {};
        const undoBtn = document.getElementById("undo_button");
        if (undoBtn) {
            this.button.undo = undoBtn;
            this.button.undo.onclick = onclickUndoButton.bind(this);
        }
        const redoBtn = document.getElementById("redo_button");
        if (redoBtn) {
            this.button.redo = redoBtn;
            this.button.redo.onclick = onclickRedoButton.bind(this);
        }
        const resetBtn = document.getElementById("reset_button");
        if (resetBtn) {
            this.button.reset = resetBtn;
            this.button.reset.onclick = () => {
                if (this.button.undo) this.button.undo.disabled = true;
                if (this.button.redo) this.button.redo.disabled = true;
                if (this.button.aiDo) this.button.aiDo.disabled = true;
                if (this.button.confirm) this.button.confirm.disabled = true;
                if (this.button.cancel) this.button.cancel.disabled = true;
                View.removePreviousFadeInoutBox();
                View.cancelPawnClick();
                View.cancelWallShadows();
                this.controller.startNewGame(true, 10000000); // ←ここを10000000に修正
            };
        }

        // ボタン関連の処理を全てスキップ

        // --- Canvas要素の取得 ---
        this.canvas = document.getElementById("quoridor-canvas");
        this.ctx = this.canvas ? this.canvas.getContext("2d") : null;
        // --- Canvasクリックイベント登録 ---
        if (this.canvas) {
            this.canvas.addEventListener('click', this.onCanvasClick.bind(this));
        }
    }

    setUIForTouchDevice() {
        const onclickConfirmButton = function(e) {
            this.button.confirm.disabled = true;
            this.button.cancel.disabled = true;
            const clickedPawns = document.getElementsByClassName("pawn clicked");
            if (clickedPawns.length > 0) {
                const clickedPawn = clickedPawns[0];
                const row = clickedPawn.parentElement.parentElement.rowIndex / 2;
                const col = clickedPawn.parentElement.cellIndex / 2;
                View.cancelPawnClick();
                this.controller.doMove([[row, col], null, null]);
            } else {
                const horizontalWallShadows = document.getElementsByClassName("horizontal_wall shadow");
                const verticalWallShadows = document.getElementsByClassName("vertical_wall shadow");
                if (horizontalWallShadows.length > 0) {
                    const horizontalWallShadow = horizontalWallShadows[0];
                    const row = (horizontalWallShadow.parentElement.parentElement.rowIndex - 1) / 2;
                    const col = horizontalWallShadow.parentElement.cellIndex / 2;
                    View.cancelWallShadows();
                    this.controller.doMove([null, [row, col], null]);
                } else if (verticalWallShadows.length > 0) {
                    const verticalWallShadow = verticalWallShadows[0];
                    const row = verticalWallShadow.parentElement.parentElement.rowIndex / 2;
                    const col = (verticalWallShadow.parentElement.cellIndex - 1) / 2;
                    View.cancelWallShadows();
                    this.controller.doMove([null, null, [row, col]]);
                }
            }
        };
        const onclickCancelButton = function(e) {
            this.button.confirm.disabled = true;
            this.button.cancel.disabled = true;
            View.cancelPawnClick();
            View.cancelWallShadows();
        };
        
        this.button.confirm.onclick = onclickConfirmButton.bind(this);
        this.button.cancel.onclick = onclickCancelButton.bind(this);
    }

    startNewGame(isHumanPlayerFirst, numOfMCTSSimulations) {
        this.htmlChoosePawnMessageBox.classList.add("hidden");
        this.controller.startNewGame(isHumanPlayerFirst, numOfMCTSSimulations);
    }

    printMessage(message) {
        // message_box削除のため何もしない
    }

    printImpossibleWallMessage() {
        // View.removePreviousFadeInoutBox();
        // boardTableContainerが無い場合はalertで代用
        const boardTableContainer = document.getElementById("board_table_container");
        if (boardTableContainer) {
            const box = document.createElement("div");
            box.classList.add("fade_box")
            box.classList.add("inout");
            box.id = "note_message_box";
            box.innerHTML = "There must remain at least one path to the goal for each pawn.";
            boardTableContainer.appendChild(box);
        } else {
            alert("There must remain at least one path to the goal for each pawn.");
        }
    }

    printGameResultMessage(message) {
        View.removePreviousFadeInoutBox();
        const box = document.createElement("div");
        box.classList.add("fade_box")
        box.classList.add("inout");
        box.id = "game_result_message_box";
        box.innerHTML = message;
        const boardTableContainer = document.getElementById("board_table_container");
        boardTableContainer.appendChild(box);
    }

    // --- Canvas描画用メソッド ---
    /**
     * 横壁はクリック範囲(cellSize x wallSize)＋右隣(wallSize x wallSize)＋右隣(cellSize x wallSize)に壁を表示
     * 縦壁も同様に、クリック範囲(wallSize x cellSize)＋下隣(wallSize x wallSize)＋下隣(wallSize x cellSize)
     * cellSize=48, wallSize=12
     */
    renderCanvasBoard() {
        if (!this.ctx || !this._game) return;
        const ctx = this.ctx;
        const boardSize = 9;
        const cellSize = 48;
        const wallSize = 12;
        const gridSize = cellSize + wallSize;
        const canvasSize = cellSize * boardSize + wallSize * (boardSize - 1);
        if (this.canvas.width !== canvasSize) this.canvas.width = canvasSize;
        if (this.canvas.height !== canvasSize) this.canvas.height = canvasSize;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        // --- 盤面マス描画 ---
        // セルは濃いグレー、セルの間（壁部分）は薄いグレー
        ctx.save();
        ctx.fillStyle = '#e0e0e0'; // 薄いグレー
        ctx.fillRect(0, 0, canvasSize, canvasSize);
        ctx.restore();
        let cellIndex = 0;
        for (let i = 0; i < boardSize; i++) {
            for (let j = 0; j < boardSize; j++) {
                const x = j * gridSize;
                const y = i * gridSize;
                ctx.save();
                ctx.fillStyle = '#888'; // 濃いグレー
                ctx.fillRect(x, y, cellSize, cellSize);
                ctx.restore();
                ctx.save();
                ctx.fillStyle = '#fff';
                ctx.font = '12px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(cellIndex, x + cellSize / 2, y + cellSize / 2);
                ctx.restore();
                cellIndex++;
            }
        }
        // --- 移動可能マスのグレースケールハイライト ---
        if (this._game.validNextPositions) {
            ctx.save();
            ctx.globalAlpha = 0.25; // さらに薄く
            ctx.fillStyle = '#222'; // 濃いグレーでハイライト
            for (let i = 0; i < 9; i++) {
                for (let j = 0; j < 9; j++) {
                    if (this._game.validNextPositions[i][j]) {
                        const x = j * gridSize;
                        const y = i * gridSize;
                        ctx.fillRect(x, y, cellSize, cellSize);
                    }
                }
            }
            ctx.restore();
        }
        // --- 壁設置可能位置のグレースケールハイライトと番号 ---
        if (this._game.validNextWalls) {
            ctx.save();
            ctx.globalAlpha = 0.35; // 少し濃く
            ctx.fillStyle = '#888'; // グレーでハイライト
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            // 横壁（左側のcell x wall範囲）
            let hWallIndex = 0;
            for (let i = 0; i < 8; i++) {
                for (let j = 0; j < 8; j++) {
                    if (this._game.validNextWalls.horizontal[i][j]) {
                        const x = j * gridSize;
                        const y = (i + 1) * cellSize + i * wallSize;
                        ctx.fillRect(x, y, cellSize, wallSize);
                        // 番号もグレースケール
                        ctx.save();
                        ctx.globalAlpha = 1.0;
                        ctx.fillStyle = '#444';
                        ctx.fillText(hWallIndex, x + cellSize / 2, y + wallSize / 2);
                        ctx.restore();
                    }
                    hWallIndex++;
                }
            }
            // 縦壁（上側のwall x cell範囲）
            let vWallIndex = 0;
            for (let i = 0; i < 8; i++) {
                for (let j = 0; j < 8; j++) {
                    if (this._game.validNextWalls.vertical[i][j]) {
                        const x = (j + 1) * cellSize + j * wallSize;
                        const y = i * gridSize;
                        ctx.fillRect(x, y, wallSize, cellSize);
                        // 番号もグレースケール
                        ctx.save();
                        ctx.globalAlpha = 1.0;
                        ctx.fillStyle = '#444';
                        ctx.fillText(vWallIndex, x + wallSize / 2, y + cellSize / 2);
                        ctx.restore();
                    }
                    vWallIndex++;
                }
            }
            ctx.restore();
        }
        // --- 壁描画 ---
        ctx.save();
        ctx.strokeStyle = '#a66'; // 元の茶色
        ctx.fillStyle = '#a66';   // 元の茶色
        ctx.lineWidth = 1;
        // 横壁
        let hWallIndex = 0;
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                if (this._game.board.walls.horizontal[i][j]) {
                    // 壁の中心がマスとマスの間に来るよう調整
                    const x = j * gridSize;
                    const y = (i + 1) * cellSize + i * wallSize;
                    ctx.fillRect(x, y, cellSize * 2 + wallSize, wallSize);
                }
                // 横壁設置番号 0-63
                // クリック範囲（cellSize x wallSize）の中央に表示
                const x = j * gridSize;
                const y = (i + 1) * cellSize + i * wallSize;
                ctx.save();
                ctx.fillStyle = '#888'; // グレースケール
                ctx.font = '12px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(hWallIndex, x + cellSize / 2, y + wallSize / 2);
                ctx.restore();
                hWallIndex++;
            }
        }
        // 縦壁
        let vWallIndex = 0;
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                if (this._game.board.walls.vertical[i][j]) {
                    // 壁の中心がマスとマスの間に来るよう調整
                    const x = (j + 1) * cellSize + j * wallSize;
                    const y = i * gridSize;
                    ctx.fillRect(x, y, wallSize, cellSize * 2 + wallSize);
                }
                // 縦壁設置番号 0-63
                // クリック範囲（wallSize x cellSize）の中央に表示
                const x = (j + 1) * cellSize + j * wallSize;
                const y = i * gridSize;
                ctx.save();
                ctx.fillStyle = '#888'; // グレースケール
                ctx.font = '12px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(vWallIndex, x + wallSize / 2, y + cellSize / 2);
                ctx.restore();
                vWallIndex++;
            }
        }
        ctx.restore();
        // --- 駒描画 ---
        const pawns = this._game.board.pawns;
        // 先手: 黒, 後手: 白
        const pawnColors = ['#111', '#fff'];
        // 枠線なし
        for (let p = 0; p < pawns.length; p++) {
            const pos = pawns[p].position;
            const x = pos.col * gridSize + cellSize / 2;
            const y = pos.row * gridSize + cellSize / 2;
            ctx.beginPath();
            ctx.arc(x, y, 18, 0, 2 * Math.PI);
            ctx.fillStyle = pawnColors[p];
            ctx.fill();
        }
    }

    render() {
        this.renderCanvasBoard(); // canvas描画
        this.renderInfoBox();
        // --- テーブルUI用の描画・操作はcanvas専用UIでは不要なのでスキップ ---
        // this._removePreviousRender();
        // this._renderNumberOfLeftWalls();
        // this._renderPawnPositions();
        // this._renderWalls();
        if (this.game.winner !== null) {
            if (this.game.winner.isHumanPlayer) {
                this.printGameResultMessage("You win against " + this.aiLevel + " AI!");
                this.printMessage("You win!");
            } else {
                this.printGameResultMessage(this.aiLevel + " AI wins!");
                this.printMessage(this.aiLevel + " AI wins!");
            }
        }
    }

    set game(game) {
        this._game = game;
    }
    get game() {
        return this._game;
    }

    _removePreviousRender() {
        for (let i = 0; i < this.htmlBoardTable.rows.length; i++) {
            for (let j = 0; j < this.htmlBoardTable.rows[0].cells.length; j++) {
                let element = this.htmlBoardTable.rows[i].cells[j];
                element.removeAttribute("onmouseenter");
                element.removeAttribute("onmouseleave");
                element.onclick = null;
            }
        }
        // remove pawn shadows which are for previous board
        let previousPawnShadows = document.getElementsByClassName("pawn shadow");
        while(previousPawnShadows.length !== 0) {
            previousPawnShadows[0].remove();
        }
    }

    _renderNumberOfLeftWalls() {
        this.htmlWallNum.pawn0.innerHTML = this.game.board.pawns[0].numberOfLeftWalls;
        this.htmlWallNum.pawn1.innerHTML = this.game.board.pawns[1].numberOfLeftWalls;
    }

    _renderPawnPositions() {
        this.htmlBoardTable.rows[this.game.board.pawns[0].position.row * 2].cells[this.game.board.pawns[0].position.col * 2].appendChild(this.htmlPawns[0]);
        this.htmlBoardTable.rows[this.game.board.pawns[1].position.row * 2].cells[this.game.board.pawns[1].position.col * 2].appendChild(this.htmlPawns[1]);
    }

    _renderValidNextPawnPositions() {
        let onclickNextPawnPosition;
        if (this.isHoverPossible) {
            onclickNextPawnPosition = function(e) {
                const x = e.target;
                const row = x.parentElement.parentElement.rowIndex / 2;
                const col = x.parentElement.cellIndex / 2;
                this.controller.doMove([[row, col], null, null]);
            };
        } else {
            onclickNextPawnPosition = function(e) {
                View.cancelPawnClick();
                View.cancelWallShadows();
                const x = e.target;
                let pawnShadows = document.getElementsByClassName("pawn shadow");
                for (let i = 0; i < pawnShadows.length; i++) {
                    if (pawnShadows[i] !== x) {
                        pawnShadows[i].classList.add("hidden");
                    }
                }
                x.classList.add("clicked");
                this.button.confirm.disabled = false;
                this.button.cancel.disabled = false;
            };
        }
        for (let i = 0; i < 9; i++) {
            for (let j = 0; j < 9; j++) {
                if (this.game.validNextPositions[i][j] === true) {
                    let element = this.htmlBoardTable.rows[i * 2].cells[j * 2];
                    let pawnShadow = document.createElement("div");
                    pawnShadow.classList.add("pawn");
                    pawnShadow.classList.add("pawn" + this.game.pawnIndexOfTurn);
                    pawnShadow.classList.add("shadow");
                    element.appendChild(pawnShadow);
                    pawnShadow.onclick = onclickNextPawnPosition.bind(this);
                }
            }
        }
    }

    _renderWalls() {
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                if(this.game.board.walls.horizontal[i][j] === true) {
                    let horizontalWall = document.createElement("div");
                    horizontalWall.classList.add("horizontal_wall");
                    if (!this.htmlBoardTable.rows[i*2+1].cells[j*2].hasChildNodes()) {
                        this.htmlBoardTable.rows[i*2+1].cells[j*2].appendChild(horizontalWall);
                    }
                }
                if(this.game.board.walls.vertical[i][j] === true) {
                    let verticalWall = document.createElement("div");
                    verticalWall.classList.add("vertical_wall");
                    if (!this.htmlBoardTable.rows[i*2].cells[j*2+1].hasChildNodes()) {
                        this.htmlBoardTable.rows[i*2].cells[j*2+1].appendChild(verticalWall);
                    }
                }
            }
        }        
    }

    _renderValidNextWalls() {
        if (this.game.pawnOfTurn.numberOfLeftWalls <= 0) {
            return;
        }
        let onclickNextHorizontalWall, onclickNextVerticalWall;
        if (this.isHoverPossible) {
            onclickNextHorizontalWall = function(e) {
                const x = e.currentTarget;
                View.horizontalWallShadow(x, false);
                const row = (x.parentElement.rowIndex - 1) / 2;
                const col = x.cellIndex / 2;
                this.controller.doMove([null, [row, col], null]);
            };
            onclickNextVerticalWall = function(e) {
                const x = e.currentTarget;
                View.verticalWallShadow(x, false);
                const row = x.parentElement.rowIndex / 2;
                const col = (x.cellIndex - 1) / 2;
                this.controller.doMove([null, null, [row, col]]);
            };
        } else {
            onclickNextHorizontalWall = function(e) {
                View.cancelPawnClick();
                View.cancelWallShadows();
                const x = e.currentTarget;
                View.horizontalWallShadow(x, true);
                this.button.confirm.disabled = false;
                this.button.cancel.disabled = false;
            };
            onclickNextVerticalWall = function(e) {
                View.cancelPawnClick();
                View.cancelWallShadows();
                const x = e.currentTarget;
                View.verticalWallShadow(x, true);
                this.button.confirm.disabled = false;
                this.button.cancel.disabled = false;
            };
        }
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                if (this.game.validNextWalls.horizontal[i][j] === true) {
                    let element = this.htmlBoardTable.rows[i * 2 + 1].cells[j * 2];
                    if (this.isHoverPossible) {
                        element.setAttribute("onmouseenter", "View.horizontalWallShadow(this, true)");
                        element.setAttribute("onmouseleave", "View.horizontalWallShadow(this, false)");
                    }                    
                    element.onclick = onclickNextHorizontalWall.bind(this);
                }
                if (this.game.validNextWalls.vertical[i][j] === true) {
                    let element = this.htmlBoardTable.rows[i * 2].cells[j * 2 + 1];
                    if (this.isHoverPossible) {
                        element.setAttribute("onmouseenter", "View.verticalWallShadow(this, true)");
                        element.setAttribute("onmouseleave", "View.verticalWallShadow(this, false)");
                    }
                    element.onclick = onclickNextVerticalWall.bind(this);
                }
            }
        }
    }

    // this is for debug or test
    render2DArrayToBoard(arr2D) {
        // remove texts printed before
        for (let i = 0; i < arr2D.length; i++) {
            for (let j = 0; j < arr2D[0].length; j++) {
                const cell = this.htmlBoardTable.rows[2*i].cells[2*j];
                if (cell.firstChild !== null && cell.firstChild.nodeType === Node.TEXT_NODE) {
                    cell.firstChild.remove();
                };
            }
        }

        if (arr2D.length === 9 && arr2D[0].length === 9) {
            for (let i = 0; i < arr2D.length; i++) {
                for (let j = 0; j < arr2D[0].length; j++) {
                    const textNode = document.createTextNode(arr2D[i][j])
                    const cell = this.htmlBoardTable.rows[2*i].cells[2*j];
                    cell.insertBefore(textNode, cell.firstChild);
                }
            }
        }
    }

    adjustProgressBar(percentage) {
        // プログレスバー機能は削除
    }

    enableUndoRedoButtonIfNecessary() {
        const gameHistory = this.controller.gameHistory;
        if (this.button.undo) this.button.undo.disabled = !(gameHistory && gameHistory.length > 1);
        if (this.button.reset) this.button.reset.disabled = !(gameHistory && gameHistory.length > 1);

        const gameHistoryTrashCan = this.controller.gameHistoryTrashCan;
        if (this.button.redo) this.button.redo.disabled = !(gameHistoryTrashCan && gameHistoryTrashCan.length > 0);
        // ゴール状態やその他状態に関係なく、履歴があればUNDO/REDOボタンを有効にする
    }

    static horizontalWallShadow(x, turnOn) {
        if (turnOn === true) {
            const _horizontalWallShadow = document.createElement("div");
            _horizontalWallShadow.classList.add("horizontal_wall");
            _horizontalWallShadow.classList.add("shadow");
            x.appendChild(_horizontalWallShadow);
        } else {
            while (x.firstChild) {
                x.removeChild(x.firstChild);
            }  
        }
    }
    
    static verticalWallShadow(x, turnOn) {
        if (turnOn === true) {
            const _verticalWallShadow = document.createElement("div");
            _verticalWallShadow.classList.add("vertical_wall");
            _verticalWallShadow.classList.add("shadow");
            x.appendChild(_verticalWallShadow);
        } else {
            while (x.firstChild) {
                x.removeChild(x.firstChild);
            }
        }
   
    }

    static cancelWallShadows() {
        let previousWallShadows = document.getElementsByClassName("horizontal_wall shadow");
        while(previousWallShadows.length !== 0) {
            previousWallShadows[0].remove();
        }
        previousWallShadows = document.getElementsByClassName("vertical_wall shadow");
        while(previousWallShadows.length !== 0) {
            previousWallShadows[0].remove();
        }
    }
    
    static cancelPawnClick() {
        let pawnShadows = document.getElementsByClassName("pawn shadow");
        for (let i = 0; i < pawnShadows.length; i++) {
            pawnShadows[i].classList.remove("clicked");
            pawnShadows[i].classList.remove("hidden");
        }
    }

    static removePreviousFadeInoutBox() {
        let previousBoxes;
        if (previousBoxes = document.getElementsByClassName("fade_box inout")) {
            while(previousBoxes.length !== 0) {
                previousBoxes[0].remove();
            }
        }
    }

    static removeWalls() {
        let previousWalls = document.querySelectorAll("td > .horizontal_wall");
        for (let i = 0; i < previousWalls.length; i++) {
            previousWalls[i].remove();
        }
        previousWalls = document.querySelectorAll("td > .vertical_wall");
        for (let i = 0; i < previousWalls.length; i++) {
            previousWalls[i].remove();
        }
    }

    /**
     * キャンバス上のクリック座標から盤面・壁の操作を判定し、コントローラに指示
     * 水平壁は左側、垂直壁は上側のクリックで設置できるように修正
     */
    onCanvasClick(e) {
        if (!this._game || !this.controller) return;
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const cellSize = 48;
        const wallSize = 12;
        const gridSize = cellSize + wallSize;
        // 盤面マスの範囲
        const col = Math.floor(x / gridSize);
        const row = Math.floor(y / gridSize);
        // cell領域内か（cellSize x cellSizeの範囲のみ）
        const cellX = col * gridSize;
        const cellY = row * gridSize;
        if (
            row >= 0 && row < 9 && col >= 0 && col < 9 &&
            x >= cellX && x < cellX + cellSize &&
            y >= cellY && y < cellY + cellSize
        ) {
            // 駒の移動可能マスか判定
            if (this._game.validNextPositions && this._game.validNextPositions[row][col]) {
                this.controller.doMove([[row, col], null, null]);
                return;
            }
        }
        // 水平壁設置判定（左側の壁の範囲をクリックした場合）
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                // 水平壁の左側のcell x wall領域
                const wx = j * gridSize;
                const wy = (i + 1) * cellSize + i * wallSize;
                if (
                    x >= wx && x < wx + cellSize &&
                    y >= wy && y < wy + wallSize
                ) {
                    if (this._game.validNextWalls && this._game.validNextWalls.horizontal[i][j]) {
                        this.controller.doMove([null, [i, j], null]);
                        return;
                    }
                }
            }
        }
        // 垂直壁設置判定（上側の壁の範囲をクリックした場合）
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                // 垂直壁の上側のwall x cell領域
                const vx = (j + 1) * cellSize + j * wallSize;
                const vy = i * gridSize;
                if (
                    x >= vx && x < vx + wallSize &&
                    y >= vy && y < vy + cellSize
                ) {
                    if (this._game.validNextWalls && this._game.validNextWalls.vertical[i][j]) {
                        this.controller.doMove([null, null, [i, j]]);
                        return;
                    }
                }
            }
        }
    }

    renderInfoBox() {
        if (!this.htmlInfoBox || !this._game) return;
        const p0 = this._game.board.pawns[0];
        const p1 = this._game.board.pawns[1];
        const turn = this._game.turn % 2;
        const turnStr = turn === 0 ? 'Black' : 'White';
        let html =
            `Black walls left: <b>${p0.numberOfLeftWalls}</b>　White walls left: <b>${p1.numberOfLeftWalls}</b>　` +
            `Turn: <b>${turnStr}</b>`;
        // --- MCTS Candidates ---
        if (this.aiDevelopMode && typeof window !== 'undefined' && window.mctsCandidates && window.mctsCandidates.length > 0) {
            // Sort by number of simulations, show top 5
            const sorted = window.mctsCandidates.slice().sort((a, b) => b.numSims - a.numSims).slice(0, 5);
            html += '<br><table class="mcts-table">';
            html += '<tr><th>Move</th><th>Win Rate</th><th>Simulations</th></tr>';
            for (const cand of sorted) {
                let moveStr = '';
                if (cand.move[0]) {
                    // Pawn move: show cell index
                    const row = cand.move[0][0];
                    const col = cand.move[0][1];
                    const cellIndex = row * 9 + col;
                    moveStr = `Pawn(${cellIndex})`;
                } else if (cand.move[1]) {
                    // Horizontal wall: show wall index
                    const row = cand.move[1][0];
                    const col = cand.move[1][1];
                    const wallIndex = row * 8 + col;
                    moveStr = `H-wall(${wallIndex})`;
                } else if (cand.move[2]) {
                    // Vertical wall: show wall index
                    const row = cand.move[2][0];
                    const col = cand.move[2][1];
                    const wallIndex = row * 8 + col;
                    moveStr = `V-wall(${wallIndex})`;
                }
                html += `<tr><td>${moveStr}</td><td>${(cand.winRate*100).toFixed(1)}%</td><td>${cand.numSims}</td></tr>`;
            }
            html += '</table>';
        }
        // --- Web Worker Candidates ---
        if (this.aiDevelopMode && typeof window !== 'undefined' && window.workerCandidates && window.workerCandidates.length > 0) {
            // Sort by number of simulations, show top 5
            const sorted = window.workerCandidates.slice().sort((a, b) => b.numSims - a.numSims).slice(0, 5);
            html += '<br><table class="mcts-table">';
            html += '<tr><th>Move</th><th>Win Rate</th><th>Simulations</th></tr>';
            for (const cand of sorted) {
                let moveStr = '';
                if (cand.move[0]) {
                    const row = cand.move[0][0];
                    const col = cand.move[0][1];
                    const cellIndex = row * 9 + col;
                    moveStr = `Pawn(${cellIndex})`;
                } else if (cand.move[1]) {
                    const row = cand.move[1][0];
                    const col = cand.move[1][1];
                    const wallIndex = row * 8 + col;
                    moveStr = `H-wall(${wallIndex})`;
                } else if (cand.move[2]) {
                    const row = cand.move[2][0];
                    const col = cand.move[2][1];
                    const wallIndex = row * 8 + col;
                    moveStr = `V-wall(${wallIndex})`;
                }
                html += `<tr><td>${moveStr}</td><td>${(cand.winRate*100).toFixed(1)}%</td><td>${cand.numSims}</td></tr>`;
            }
            html += '</table>';
            if (window.workerTotalNumOfSimulations !== undefined) {
                html += `<div class="mcts-total-sims">Total simulations: <b>${window.workerTotalNumOfSimulations}</b></div>`;
            }
        }
        // --- 通常MCTS Candidates ---
        if (this.aiDevelopMode && typeof window !== 'undefined' && window.mctsCandidates && window.mctsCandidates.length > 0) {
            // Sort by number of simulations, show top 5
            const sorted = window.mctsCandidates.slice().sort((a, b) => b.numSims - a.numSims).slice(0, 5);
            html += '<br><table class="mcts-table">';
            html += '<tr><th>Move</th><th>Win Rate</th><th>Simulations</th></tr>';
            for (const cand of sorted) {
                let moveStr = '';
                if (cand.move[0]) {
                    // Pawn move: show cell index
                    const row = cand.move[0][0];
                    const col = cand.move[0][1];
                    const cellIndex = row * 9 + col;
                    moveStr = `Pawn(${cellIndex})`;
                } else if (cand.move[1]) {
                    // Horizontal wall: show wall index
                    const row = cand.move[1][0];
                    const col = cand.move[1][1];
                    const wallIndex = row * 8 + col;
                    moveStr = `H-wall(${wallIndex})`;
                } else if (cand.move[2]) {
                    // Vertical wall: show wall index
                    const row = cand.move[2][0];
                    const col = cand.move[2][1];
                    const wallIndex = row * 8 + col;
                    moveStr = `V-wall(${wallIndex})`;
                }
                html += `<tr><td>${moveStr}</td><td>${(cand.winRate*100).toFixed(1)}%</td><td>${cand.numSims}</td></tr>`;
            }
            html += '</table>';
            if (window.mctsTotalNumOfSimulations !== undefined) {
                html += `<div class="mcts-total-sims">Total simulations: <b>${window.mctsTotalNumOfSimulations}</b></div>`;
            }
        }
        this.htmlInfoBox.innerHTML = html;
    }
}

