window.onload = function() {
    // 人間対人間モード（AI開発モードをtrueに）
    const controller = new Controller(1.4, true);
    controller.startNewGame(true, 10000000); // シミュレーション回数を10000000回に
    controller.view.render();
    window.controller = controller;
    // MCTSモードON/OFF用フラグ
    let mctsMode = false;
    const mctsBtn = document.getElementById('mcts_button');
    if (mctsBtn) {
        mctsBtn.onclick = function() {
            mctsMode = !mctsMode;
            if (mctsMode) {
                mctsBtn.classList.add('active');
                if (controller && controller.showMCTSCandidates) {
                    controller.showMCTSCandidates({ updateInterval: 1000 });
                }
            } else {
                mctsBtn.classList.remove('active');
                // OFF時の処理（worker停止のみ）
                if (controller.worker) {
                    controller.worker.terminate();
                    controller.worker = null;
                }
                // info_boxやプログレスバーは消さない
            }
        };
    }

    // --- いって進める・UNDO・RESET時にMCTS再始動 ---
    function restartMCTSIfNeeded() {
        if (mctsMode && controller && controller.showMCTSCandidates) {
            if (controller.worker) {
                controller.worker.terminate();
                controller.worker = null;
            }
            controller.showMCTSCandidates({ updateInterval: 1000 });
        }
    }
    // doMove, undo, redo, startNewGameをフック
    const origDoMove = controller.doMove.bind(controller);
    controller.doMove = function(move) {
        origDoMove(move);
        restartMCTSIfNeeded();
    };
    const origUndo = controller.undo.bind(controller);
    controller.undo = function() {
        origUndo();
        restartMCTSIfNeeded();
    };
    const origRedo = controller.redo.bind(controller);
    controller.redo = function() {
        origRedo();
        restartMCTSIfNeeded();
    };
    const origStartNewGame = controller.startNewGame.bind(controller);
    controller.startNewGame = function(isHumanPlayerFirst, numOfMCTSSimulations) {
        origStartNewGame(isHumanPlayerFirst, numOfMCTSSimulations);
        restartMCTSIfNeeded();
    };

    // 盤面反転ボタン
    const flipBtn = document.getElementById('flip_button');
    let isFlipped = false;
    if (flipBtn) {
        flipBtn.onclick = function() {
            isFlipped = !isFlipped;
            if (isFlipped) {
                flipBtn.classList.add('active');
            } else {
                flipBtn.classList.remove('active');
            }
            controller.view.isFlipped = isFlipped;
            controller.view.render();
        };
    }
};
