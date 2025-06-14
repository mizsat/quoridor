"use strict";

/*
* game.js
*
* Quoridor（クオリドル）ゲームのモデル部分（MVCパターンのModel）を実装。
* 盤面・駒・壁・ルールなど、ゲームの状態管理とロジックを担当。
*/

/*
* 【データ構造の説明】
*   - PawnPosition: 駒の位置を表す（row, col）
*   - Walls（Horizontal/Vertical）: 壁の位置を表す2次元配列（true: 壁あり, false: 壁なし）
*   - OpenWays UpDown/LeftRight: 隣接マス間の通路が開いているか（true: 開通, false: 壁で遮断）
*   - 盤面や壁の配列インデックスは下記のように対応
*     例：9x9マスの盤面、壁は8x8マス分
*/

// pawnMoveTuple: 駒の移動方向を表す定数（[行方向, 列方向]）
const MOVE_UP = [-1, 0];    // 上に移動
const MOVE_DOWN = [1, 0];   // 下に移動
const MOVE_LEFT = [0, -1];  // 左に移動
const MOVE_RIGHT = [0, 1];  // 右に移動

/**
 * 指定サイズ・初期値で2次元配列を生成
 * @param {number} numOfRow 行数
 * @param {number} numOfCol 列数
 * @param {*} initialValue 初期値
 * @returns {Array}
 */
function create2DArrayInitializedTo(numOfRow, numOfCol, initialValue) {
    const arr2D = [];
    for (let i = 0; i < numOfRow; i++) {
        let row = [];
        for (let j = 0; j < numOfCol; j++) {
            row.push(initialValue);
        }
        arr2D.push(row);
    }
    return arr2D;
}

/**
 * 2次元配列の全要素を指定値で埋める
 * @param {Array} arr2D
 * @param {*} value
 */
function set2DArrayEveryElementToValue(arr2D, value) {
    for (let i = 0; i < arr2D.length; i++) {
        for (let j = 0; j < arr2D[0].length; j++) {
            arr2D[i][j] = value;
        }
    }
}

/**
 * 2次元配列をディープコピー
 * @param {Array} arr2D
 * @returns {Array}
 */
function create2DArrayClonedFrom(arr2D) {
    const arr2DCloned = [];
    for (let i = 0; i < arr2D.length; i++) {
        arr2DCloned.push([...arr2D[i]]);
    }
    return arr2DCloned;
}

/**
 * 2つの2次元配列の論理積（AND）を計算
 * @param {Array} arr2DA
 * @param {Array} arr2DB
 * @returns {Array}
 */
function logicalAndBetween2DArray(arr2DA, arr2DB) {
    const arr2D = [];
    for (let i = 0; i < arr2DA.length; i++) {
        let row = [];
        for (let j = 0; j < arr2DA[0].length; j++) {
            row.push(arr2DA[i][j] && arr2DB[i][j]);
        }
        arr2D.push(row);
    }
    return arr2D;
}

/**
 * 駒の位置を表すクラス
 * row: 行番号, col: 列番号
 */
class PawnPosition {
    constructor(row, col) {
        this.row = row;
        this.col = col;
    }

    /**
     * 他のPawnPositionと同じ位置か判定
     */
    equals(otherPosition) {
        return this.row === otherPosition.row && this.col === otherPosition.col;
    }

    /**
     * 指定方向に移動した新しいPawnPositionを返す
     * @param {Array} pawnMoveTuple [行方向, 列方向]
     * @returns {PawnPosition}
     */
    newAddMove(pawnMoveTuple) {
        return new PawnPosition(this.row + pawnMoveTuple[0], this.col + pawnMoveTuple[1]);
    }
}

/**
 * 駒（Pawn）を表すクラス
 * index: 0=先手, 1=後手
 * isHumanSide: ユーザー側か
 * isHumanPlayer: ユーザーが操作する駒か
 * position: 現在位置
 * goalRow: ゴール行
 * numberOfLeftWalls: 残り壁数
 */
class Pawn {
    constructor(index, isHumanSide, isHumanPlayer, forClone = false) {
        this.index = null;
        this.isHumanSide = null;
        this.isHumanPlayer = null;
        this.position = null;
        this.goalRow = null;
        this.numberOfLeftWalls = null;
        if (!forClone) {
            // index === 0: 先手（明るい色）, index === 1: 後手（暗い色）
            this.index = index;
            this.isHumanPlayer = isHumanPlayer;
            if (isHumanSide === true) {
                this.isHumanSide = true;
                this.position = new PawnPosition(8, 4); // ユーザー側は下段中央から開始
                this.goalRow = 0;
            } else {
                this.isHumanSide = false;
                this.position = new PawnPosition(0, 4); // AI側は上段中央から開始
                this.goalRow = 8;
            }
            this.numberOfLeftWalls = 10; // 初期壁数
        }
    }
}

/**
 * 盤面（Board）を表すクラス
 * pawns: 駒の配列
 * walls: 壁の配置（horizontal/vertical）
 */
class Board {
    constructor(isHumanPlayerFirst, forClone = false) {
        this.pawns = null;
        this.walls = null;
        if (!forClone) {
            // pawns[0]: 先手, pawns[1]: 後手
            if (isHumanPlayerFirst === true) {
                this.pawns = [new Pawn(0, true, true), new Pawn(1, false, false)];
            } else {
                this.pawns = [new Pawn(0, false, false), new Pawn(1, true, true)];
            }
            // 壁配置（8x8, 初期値false）
            this.walls = {horizontal: create2DArrayInitializedTo(8, 8, false), vertical: create2DArrayInitializedTo(8, 8, false)};
        }
    }
}

/**
 * Quoridorゲーム全体とルールを管理するクラス
 * board: 盤面
 * winner: 勝者（null=未決定, 0=先手, 1=後手）
 * _turn: 現在のターン数
 * validNextWalls: 設置可能な壁位置
 * openWays: 各マス間の通路状態
 * その他、AI探索用の補助変数
 */
class Game {
    constructor(isHumanPlayerFirst, forClone = false) {
        this.board = null;
        this.winner = null;
        this._turn = null;
        this.validNextWalls = null;
        this._probableNextWalls = null;
        this._probableValidNextWalls = null;
        this._probableValidNextWallsUpdated = null;
        this.openWays = null;
        this._validNextPositions = null;
        this._validNextPositionsUpdated = null;
        if (!forClone) {
            this.board = new Board(isHumanPlayerFirst);
            this.winner = null;
            this._turn = 0;
            // validNextWalls: 壁設置可能位置（8x8, true=設置可, false=不可）
            this.validNextWalls = {horizontal: create2DArrayInitializedTo(8, 8, true), vertical: create2DArrayInitializedTo(8, 8, true)};
            this._probableNextWalls = {horizontal: create2DArrayInitializedTo(8, 8, false), vertical: create2DArrayInitializedTo(8, 8, false)};
            this._probableValidNextWalls = null;
            this._probableValidNextWallsUpdated = false;
            this.openWays = {upDown: create2DArrayInitializedTo(8, 9, true), leftRight: create2DArrayInitializedTo(9, 8, true)};
            this._validNextPositions = create2DArrayInitializedTo(9, 9, false);
            this._validNextPositionsUpdated = false;
            this.updateValidNextWalls(); // 追加: 初期状態で合法な壁のみtrueに
        }
    }

    get turn() {
        return this._turn;
    }

    set turn(newTurn) {
        this._turn = newTurn;
        this._validNextPositionsUpdated = false;
        this._probableValidNextWallsUpdated = false;
    }

    get pawn0() {
        return this.board.pawns[0];
    }

    get pawn1() {
        return this.board.pawns[1];
    }

    get pawnIndexOfTurn() {
        return this.turn % 2;
    }

    get pawnIndexOfNotTurn() {
        return (this.turn + 1) % 2;
    }

    get pawnOfTurn() {
        return this.board.pawns[this.pawnIndexOfTurn];
    }

    get pawnOfNotTurn() {
        return this.board.pawns[this.pawnIndexOfNotTurn];
    }

    // heuristic:
    // In expansion phase,
    // do not consider all possible wall positions,
    // only consider probable next walls.
    // This heuristic decreases the branching factor.
    //
    // Probable next walls are
    // 1. near pawns (to disturb opponent or support myself)
    // 2. near already placed walls
    // 3. leftest side, rightest side horizontal walls
    get probableValidNextWalls() {
        if (this._probableValidNextWallsUpdated) {
            return this._probableValidNextWalls;
        }
        this._probableValidNextWallsUpdated = true;
        
        // near already placed walls
        const _probableValidNextWalls = {
            horizontal: create2DArrayClonedFrom(this._probableNextWalls.horizontal),
            vertical: create2DArrayClonedFrom(this._probableNextWalls.vertical)
        }

        // leftmost and rightmost horizontal walls
        // after several turns
        if (this.turn >= 6) {
            for (let i = 0; i < 8; i++) {
                _probableValidNextWalls.horizontal[i][0] = true;
                _probableValidNextWalls.horizontal[i][7] = true;
            }
        }
        
        // near pawns
        // place walls to diturb opponent or support myself
        // --- 序盤から壁設置候補を含めるよう修正 ---
        Game.setWallsBesidePawn(_probableValidNextWalls, this.pawnOfNotTurn);
        Game.setWallsBesidePawn(_probableValidNextWalls, this.pawnOfTurn);
        // --- もとの分岐はコメントアウト ---
        // if (this.turn >= 3) {
        //     // disturb opponent
        //     Game.setWallsBesidePawn(_probableValidNextWalls, this.pawnOfNotTurn);
        // }
        // if (this.turn >= 6
        //     || indicesOfValueIn2DArray(this.board.walls.horizontal, true).length > 0
        //     || indicesOfValueIn2DArray(this.board.walls.vertical, true).length > 0) {
        //     // support myself    
        //     Game.setWallsBesidePawn(_probableValidNextWalls, this.pawnOfTurn);
        // }
        _probableValidNextWalls.horizontal = logicalAndBetween2DArray(_probableValidNextWalls.horizontal, this.validNextWalls.horizontal);
        _probableValidNextWalls.vertical = logicalAndBetween2DArray(_probableValidNextWalls.vertical, this.validNextWalls.vertical);
        this._probableValidNextWalls = _probableValidNextWalls;
        return _probableValidNextWalls;
    }

    get validNextPositions() {
        if (this._validNextPositionsUpdated === true) {
            return this._validNextPositions;
        }
        this._validNextPositionsUpdated = true;

        set2DArrayEveryElementToValue(this._validNextPositions, false);
        
        this._set_validNextPositionsToward(MOVE_UP, MOVE_LEFT, MOVE_RIGHT);
        this._set_validNextPositionsToward(MOVE_DOWN, MOVE_LEFT, MOVE_RIGHT);
       
        this._set_validNextPositionsToward(MOVE_LEFT, MOVE_UP, MOVE_DOWN);
        this._set_validNextPositionsToward(MOVE_RIGHT, MOVE_UP, MOVE_DOWN);
        
        return this._validNextPositions;
    }

    // check and set this._validNextPostions toward mainMove.
    // subMoves are needed for jumping case.
    _set_validNextPositionsToward(mainMove, subMove1, subMove2) {
        if (this.isValidNextMoveNotConsideringOtherPawn(this.pawnOfTurn.position, mainMove)) {
            // mainMovePosition: the pawn's position after main move
            let mainMovePosition = this.pawnOfTurn.position.newAddMove(mainMove);
            // if the other pawn is on the position after main move (e.g. up)
            if (mainMovePosition.equals(this.pawnOfNotTurn.position)) {
                // check for jumping toward main move (e.g. up) direction
                if (this.isValidNextMoveNotConsideringOtherPawn(mainMovePosition, mainMove)) {
                    // mainMainMovePosition: the pawn's position after two main move
                    let mainMainMovePosition = mainMovePosition.newAddMove(mainMove);
                    this._validNextPositions[mainMainMovePosition.row][mainMainMovePosition.col] = true;
                } else {
                    // check for jumping toward sub move 1 (e.g. left) direction
                    if (this.isValidNextMoveNotConsideringOtherPawn(mainMovePosition, subMove1)) {
                        // mainSub1MovePosition: the pawn's position after (main move + sub move 1)
                        let mainSub1MovePosition = mainMovePosition.newAddMove(subMove1);
                        this._validNextPositions[mainSub1MovePosition.row][mainSub1MovePosition.col] = true;
                    }
                    // check for jumping toward sub move 2 (e.g. right) direction
                    if (this.isValidNextMoveNotConsideringOtherPawn(mainMovePosition, subMove2)) {
                        // mainSub2MovePosition: the pawn's position after (main move + sub move 2)
                        let mainSub2MovePosition = mainMovePosition.newAddMove(subMove2);
                        this._validNextPositions[mainSub2MovePosition.row][mainSub2MovePosition.col] = true;
                    }
                }
            } else {
                this._validNextPositions[mainMovePosition.row][mainMovePosition.col] = true;
            }
        }
    }

    // this method checks if the pawnMoveTuple of the pawn of this turn is valid against walls on the board and the board size.
    // this method do not check the validity against the other pawn's position. 
    isValidNextMoveNotConsideringOtherPawn(currentPosition, pawnMoveTuple) {
        if (pawnMoveTuple[0] === -1 && pawnMoveTuple[1] === 0) { // up
            return (currentPosition.row > 0 && this.openWays.upDown[currentPosition.row - 1][currentPosition.col]);
        }
        if (pawnMoveTuple[0] === 1 && pawnMoveTuple[1] === 0) { // down
            return (currentPosition.row < 8 && this.openWays.upDown[currentPosition.row][currentPosition.col]);
        }
        else if (pawnMoveTuple[0] === 0 && pawnMoveTuple[1] === -1) { // left
            return (currentPosition.col > 0 && this.openWays.leftRight[currentPosition.row][currentPosition.col - 1]);
        }
        else if (pawnMoveTuple[0] === 0 && pawnMoveTuple[1] === 1) { // right
            return (currentPosition.col < 8 && this.openWays.leftRight[currentPosition.row][currentPosition.col]);
        } else {
            throw "pawnMoveTuple should be one of [1, 0], [-1, 0], [0, 1], [0, -1]"
        }
    }

    isOpenWay(currentRow, currentCol, pawnMoveTuple) {
        if (pawnMoveTuple[0] === -1 && pawnMoveTuple[1] === 0)  {   // up
            return (currentRow > 0 && this.openWays.upDown[currentRow - 1][currentCol]);
        } else if (pawnMoveTuple[0] === 1 && pawnMoveTuple[1] === 0) {  //down
            return (currentRow < 8 && this.openWays.upDown[currentRow][currentCol]);
        } else if (pawnMoveTuple[0] === 0 && pawnMoveTuple[1] === -1) {  // left
            return (currentCol > 0 && this.openWays.leftRight[currentRow][currentCol - 1]);
        } else if (pawnMoveTuple[0] === 0 && pawnMoveTuple[1] === 1) {  // right
            return (currentCol < 8 && this.openWays.leftRight[currentRow][currentCol]);
        } else {
            throw "pawnMoveTuple should be one of [1, 0], [-1, 0], [0, 1], [0, -1]"
        }
    }

    movePawn(row, col, needCheck = false) {
        if (needCheck && this.validNextPositions[row][col] !== true) {
            return false;
        }
        this.pawnOfTurn.position.row = row;
        this.pawnOfTurn.position.col = col;
        // ゴール行に到達した場合は勝者を設定
        if (this.pawnOfTurn.goalRow === this.pawnOfTurn.position.row) {
            this.winner = this.pawnOfTurn;
        }
        this.turn++;
        return true;
    }

    testIfAdjecentToOtherWallForHorizontalWallLeft(row, col) {
        if (col >= 1) {
            if (this.board.walls.vertical[row][col-1]) {
                return true;
            }
            if (row >= 1) {
                if (this.board.walls.vertical[row-1][col-1]) {
                    return true;
                }
            }
            if (row <= 6) {
                if (this.board.walls.vertical[row+1][col-1]) {
                    return true;
                }
            }
            if (col >= 2) {
                if (this.board.walls.horizontal[row][col-2]) {
                    return true;
                }
            }
        }
        return false;
    }

    testIfAdjecentToOtherWallForHorizontalWallRight(row, col) {
        if (col <= 6) {
            if (this.board.walls.vertical[row][col+1]) {
                return true;
            }
            if (row >= 1) {
                if (this.board.walls.vertical[row-1][col+1]) {
                    return true;
                }
            }
            if (row <= 6) {
                if (this.board.walls.vertical[row+1][col+1]) {
                    return true;
                }
            }
            if (col <= 5) {
                if (this.board.walls.horizontal[row][col+2]) {
                    return true;
                }
            }
        }
        return false;
    }

    testIfAdjecentToOtherWallForHorizontalWallMiddle(row, col) {
        if (row >= 1) {
            if (this.board.walls.vertical[row-1][col]) {
                return true;
            }
        }
        if (row <= 6) {
            if (this.board.walls.vertical[row+1][col]) {
                return true;
            }
        }
        return false;
    }

    testIfConnectedOnTwoPointsForHorizontalWall(row, col) {
        // if left side is connected with border of board or other wall
        const left = (col === 0 || this.testIfAdjecentToOtherWallForHorizontalWallLeft(row, col));
        // if right side is connected with border of board or other wall
        const right = (col === 7 || this.testIfAdjecentToOtherWallForHorizontalWallRight(row, col));
        const middle = this.testIfAdjecentToOtherWallForHorizontalWallMiddle(row, col);
        return (left && right) || (right && middle) || (middle && left);
    }

    testIfAdjecentToOtherWallForVerticalWallTop(row, col) {
        if (row >= 1) {
            if (this.board.walls.horizontal[row-1][col]) {
                return true;
            }
            if (col >= 1) {
                if (this.board.walls.horizontal[row-1][col-1]) {
                    return true;
                }
            }
            if (col <= 6) {
                if (this.board.walls.horizontal[row-1][col+1]) {
                    return true;
                }
            }
            if (row >= 2) {
                if (this.board.walls.vertical[row-2][col]) {
                    return true;
                }
            }
        }
        return false;
    }

    testIfAdjecentToOtherWallForVerticalWallBottom(row, col) {
        if (row <= 6) {
            if (this.board.walls.horizontal[row+1][col]) {
                return true;
            }
            if (col >= 1) {
                if (this.board.walls.horizontal[row+1][col-1]) {
                    return true;
                }
            }
            if (col <= 6) {
                if (this.board.walls.horizontal[row+1][col+1]) {
                    return true;
                }
            }
            if (row <= 5) {
                if (this.board.walls.vertical[row+2][col]) {
                    return true;
                }
            }
        }
        return false;
    }

    testIfAdjecentToOtherWallForVerticalWallMiddle(row, col) {
        if (col >= 1) {
            if (this.board.walls.horizontal[row][col-1]) {
                return true;
            }
        }
        if (col <= 6) {
            if (this.board.walls.horizontal[row][col+1]) {
                return true;
            }
        }
        return false;
    }

    testIfConnectedOnTwoPointsForVerticalWall(row, col) {
        // if top side is connected with border of board or other wall
        const top = (row === 0) || this.testIfAdjecentToOtherWallForVerticalWallTop(row, col);
        // if bottom side is connected with border of board or other wall
        const bottom = (row === 7) || this.testIfAdjecentToOtherWallForVerticalWallBottom(row, col);
        const middle = this.testIfAdjecentToOtherWallForVerticalWallMiddle(row, col);
        return (top && bottom) || (bottom && middle) || (middle && top);
    }

    testIfExistPathsToGoalLinesAfterPlaceHorizontalWall(row, col) {
        // wall which does not connected on two points do not block path.
        if (!this.testIfConnectedOnTwoPointsForHorizontalWall(row, col)) {
            return true;
        }
        this.openWays.upDown[row][col] = false;
        this.openWays.upDown[row][col + 1] = false;
        const result = this._existPathsToGoalLines();
        this.openWays.upDown[row][col] = true;
        this.openWays.upDown[row][col + 1] = true;
        return result
    }

    testIfExistPathsToGoalLinesAfterPlaceVerticalWall(row, col) {
        // wall which does not connected on two points do not block path.
        if (!this.testIfConnectedOnTwoPointsForVerticalWall(row, col)) {
            return true;
        }
        this.openWays.leftRight[row][col] = false;
        this.openWays.leftRight[row+1][col] = false;
        const result = this._existPathsToGoalLines();
        this.openWays.leftRight[row][col] = true;
        this.openWays.leftRight[row+1][col] = true;
        return result
    }

    isPossibleNextMove(move) {
        const movePawnTo = move[0];
        const placeHorizontalWallAt = move[1];
        const placeVerticalWallAt = move[2];
        if (movePawnTo) {
            return this.validNextPositions[movePawnTo[0]][movePawnTo[1]];
        } else if (placeHorizontalWallAt) {
            return this.testIfExistPathsToGoalLinesAfterPlaceHorizontalWall(placeHorizontalWallAt[0], placeHorizontalWallAt[1]);
        } else if (placeVerticalWallAt) {
            return this.testIfExistPathsToGoalLinesAfterPlaceVerticalWall(placeVerticalWallAt[0], placeVerticalWallAt[1]);
        }
    }

    adjustProbableValidNextWallForAfterPlaceHorizontalWall(row, col) {
        if (row >= 1) {
            this._probableNextWalls.vertical[row-1][col] = true;
        }
        if (row <= 6) {
            this._probableNextWalls.vertical[row+1][col] = true;
        }
        if (col >= 1) {
            this._probableNextWalls.vertical[row][col-1] = true;
            if (row >= 1) {
                this._probableNextWalls.vertical[row-1][col-1] = true;
            }
            if (row <= 6) {
                this._probableNextWalls.vertical[row+1][col-1] = true;
            }
            if (col >= 2) {
                this._probableNextWalls.horizontal[row][col-2] = true;
                this._probableNextWalls.vertical[row][col-2] = true;
                if (col >= 3) {
                    this._probableNextWalls.horizontal[row][col-3] = true;
                }
            }
        }
        if (col <= 6) {
            this._probableNextWalls.vertical[row][col+1] = true;
            if (row >= 1) {
                this._probableNextWalls.vertical[row-1][col+1] = true;
            }
            if (row <= 6) {
                this._probableNextWalls.vertical[row+1][col+1] = true;
            }
            if (col <= 5) {
                this._probableNextWalls.horizontal[row][col+2] = true;
                this._probableNextWalls.vertical[row][col+2] = true;
                if (col <= 4) {
                    this._probableNextWalls.horizontal[row][col+3] = true;
                }
            }
        }
    }

    adjustProbableValidNextWallForAfterPlaceVerticalWall(row, col) {
        if (col >= 1) {
            this._probableNextWalls.horizontal[row][col-1] = true;
        }
        if (col <= 6) {
            this._probableNextWalls.horizontal[row][col+1] = true;
        }
        if (row >= 1) {
            this._probableNextWalls.horizontal[row-1][col] = true;
            if (col >= 1) {
                this._probableNextWalls.horizontal[row-1][col-1] = true;
            }
            if (col <= 6) {
                this._probableNextWalls.horizontal[row-1][col+1] = true;
            }
            if (row >= 2) {
                this._probableNextWalls.vertical[row-2][col] = true;
                this._probableNextWalls.horizontal[row-2][col] = true;
                if (row >= 3) {
                    this._probableNextWalls.vertical[row-3][col] = true;
                }
            }
        }
        if (row <= 6) {
            this._probableNextWalls.horizontal[row+1][col] = true;
            if (col >= 1) {
                this._probableNextWalls.horizontal[row+1][col-1] = true;
            }
            if (col <= 6) {
                this._probableNextWalls.horizontal[row+1][col+1] = true;
            }
            if (row <= 5) {
                this._probableNextWalls.vertical[row+2][col] = true;
                this._probableNextWalls.horizontal[row+2][col] = true;
                if (row <= 4) {
                    this._probableNextWalls.vertical[row+3][col] = true;
                }
            }
        }
    }

    placeHorizontalWall(row, col, needCheck = false) {
        if (needCheck && !this.testIfExistPathsToGoalLinesAfterPlaceHorizontalWall(row, col)) {
            return false;
        }
        this.openWays.upDown[row][col] = false;
        this.openWays.upDown[row][col + 1] = false;
        this.validNextWalls.vertical[row][col] = false;
        this.validNextWalls.horizontal[row][col] = false;
        if (col > 0) {
            this.validNextWalls.horizontal[row][col - 1] = false;
        }
        if (col < 7) {
            this.validNextWalls.horizontal[row][col + 1] = false;
        }
        this.board.walls.horizontal[row][col] = true;
        
        this.adjustProbableValidNextWallForAfterPlaceHorizontalWall(row, col);
        this.pawnOfTurn.numberOfLeftWalls--;
        this.turn++;
        return true;
    }

    placeVerticalWall(row, col, needCheck = false) {
        if (needCheck && !this.testIfExistPathsToGoalLinesAfterPlaceVerticalWall(row, col)) {
            return false;
        }
        this.openWays.leftRight[row][col] = false;
        this.openWays.leftRight[row+1][col] = false;
        this.validNextWalls.horizontal[row][col] = false;
        this.validNextWalls.vertical[row][col] = false;
        if (row > 0) {
            this.validNextWalls.vertical[row-1][col] = false;
        }
        if (row < 7) {
            this.validNextWalls.vertical[row+1][col] = false;
        }
        this.board.walls.vertical[row][col] = true;
        
        this.adjustProbableValidNextWallForAfterPlaceVerticalWall(row, col);
        this.pawnOfTurn.numberOfLeftWalls--;
        this.turn++;
        return true;
    }

    // only one argument must be provided by 2-element array.
    // other two arguments must be null.
    doMove(move, needCheck = false) {
        if (this.winner !== null) {
            console.log("error: doMove after already terminal......") // for debug
        }
        const movePawnTo = move[0];
        const placeHorizontalWallAt = move[1];
        const placeVerticalWallAt = move[2];
        if (movePawnTo) {
            return this.movePawn(movePawnTo[0], movePawnTo[1], needCheck);
        } else if (placeHorizontalWallAt) {
            return this.placeHorizontalWall(placeHorizontalWallAt[0], placeHorizontalWallAt[1], needCheck);
        } else if (placeVerticalWallAt) {
            return this.placeVerticalWall(placeVerticalWallAt[0], placeVerticalWallAt[1], needCheck);
        }
    }

    // --- 壁設置可能位置を合法手のみtrueに更新 ---
    updateValidNextWalls() {
        set2DArrayEveryElementToValue(this.validNextWalls.horizontal, false);
        set2DArrayEveryElementToValue(this.validNextWalls.vertical, false);
        // 横壁
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                if (
                    this.board.walls.horizontal[i][j] ||
                    this.board.walls.vertical[i][j] ||
                    (j > 0 && this.board.walls.horizontal[i][j - 1]) ||
                    (j < 7 && this.board.walls.horizontal[i][j + 1])
                ) {
                    continue;
                }
                // 仮置き: 壁とopenWaysを一時的に更新
                this.board.walls.horizontal[i][j] = true;
                const prevUpDown0 = this.openWays.upDown[i][j];
                const prevUpDown1 = this.openWays.upDown[i][j+1];
                this.openWays.upDown[i][j] = false;
                this.openWays.upDown[i][j+1] = false;
                const ok = this._existPathsToGoalLines();
                // 元に戻す
                this.board.walls.horizontal[i][j] = false;
                this.openWays.upDown[i][j] = prevUpDown0;
                this.openWays.upDown[i][j+1] = prevUpDown1;
                this.validNextWalls.horizontal[i][j] = ok;
            }
        }
        // 縦壁
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                if (
                    this.board.walls.vertical[i][j] ||
                    this.board.walls.horizontal[i][j] ||
                    (i > 0 && this.board.walls.vertical[i - 1][j]) ||
                    (i < 7 && this.board.walls.vertical[i + 1][j])
                ) {
                    continue;
                }
                // 仮置き: 壁とopenWaysを一時的に更新
                this.board.walls.vertical[i][j] = true;
                const prevLeftRight0 = this.openWays.leftRight[i][j];
                const prevLeftRight1 = this.openWays.leftRight[i+1][j];
                this.openWays.leftRight[i][j] = false;
                this.openWays.leftRight[i+1][j] = false;
                const ok = this._existPathsToGoalLines();
                // 元に戻す
                this.board.walls.vertical[i][j] = false;
                this.openWays.leftRight[i][j] = prevLeftRight0;
                this.openWays.leftRight[i+1][j] = prevLeftRight1;
                this.validNextWalls.vertical[i][j] = ok;
            }
        }
    }

    _existPathsToGoalLines() {
        return (this._existPathToGoalLineFor(this.pawnOfTurn) && this._existPathToGoalLineFor(this.pawnOfNotTurn))
    }
    
    // Intuitively DFS would be better than BFS on this function.
    // Tested somewhat between DFS and BFS for checking intuition.
    _existPathToGoalLineFor(pawn) {
        const visited = create2DArrayInitializedTo(9, 9, false);
        const pawnMoveTuples = [MOVE_UP, MOVE_LEFT, MOVE_RIGHT, MOVE_DOWN];
        const depthFirstSearch = function(currentRow, currentCol, goalRow) {
            for (const pawnMoveTuple of pawnMoveTuples) {
                if (this.isOpenWay(currentRow, currentCol, pawnMoveTuple)) {
                    const nextRow = currentRow + pawnMoveTuple[0];
                    const nextCol = currentCol + pawnMoveTuple[1];
                    if (!visited[nextRow][nextCol]) {
                        visited[nextRow][nextCol] = true;
                        if (nextRow === goalRow) {
                            return true;
                        }
                        if(depthFirstSearch.bind(this)(nextRow, nextCol, goalRow)) {
                            return true;
                        }
                    }
                }
            }
            return false;
        };
        return depthFirstSearch.bind(this)(pawn.position.row, pawn.position.col, pawn.goalRow);
    }

    static setWallsBesidePawn(wall2DArrays, pawn) {       
        const row = pawn.position.row;
        const col = pawn.position.col;
        if (row >= 1) {
            if (col >= 1) {
                wall2DArrays.horizontal[row-1][col-1] = true;
                wall2DArrays.vertical[row-1][col-1] = true;
                if (col >= 2) {
                    wall2DArrays.horizontal[row-1][col-2] = true;
                }
            }
            if (col <= 7) {
                wall2DArrays.horizontal[row-1][col] = true;
                wall2DArrays.vertical[row-1][col] = true;
                if (col <= 6) {
                    wall2DArrays.horizontal[row-1][col+1] = true;
                }
            }
            if (row >= 2) {
                if (col >= 1) { 
                    wall2DArrays.vertical[row-2][col-1] = true;
                }
                if (col <= 7) {
                    wall2DArrays.vertical[row-2][col] = true;
                }
            }
        }
        if (row <= 7) {
            if (col >= 1) {
                wall2DArrays.horizontal[row][col-1] = true;
                wall2DArrays.vertical[row][col-1] = true;
                if (col >= 2) {
                    wall2DArrays.horizontal[row][col-2] = true;
                }
            }
            if (col <= 7) {
                wall2DArrays.horizontal[row][col] = true;
                wall2DArrays.vertical[row][col] = true;
                if (col <= 6) {
                    wall2DArrays.horizontal[row][col+1] = true;
                }
            }
            if (row <= 6) {
                if (col >= 1) { 
                    wall2DArrays.vertical[row+1][col-1] = true;
                }
                if (col <= 7) {
                    wall2DArrays.vertical[row+1][col] = true;
                }
            }
        }
    }
}
