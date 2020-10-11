$(function(){
	//========== 定数定義 ========================================
	// 基本データ
	var CELL_WIDTH = 52;	// セルの幅
	var CELL_HEIGHT = 44;	// セルの高さ
	var COL_NUM = 6;		// フィールドの横のセル数
	var ROW_NUM = 8;		// フィールドの縦のセル数
	var CELL_DATA_NUM = (COL_NUM + 2) * (ROW_NUM + 2);	// セルデータ数（フィールドの端に番兵を置く）
	var FIELD_WIDTH = CELL_WIDTH * COL_NUM;		// フィールドの幅
	var FIELD_HEIGHT = CELL_HEIGHT * ROW_NUM;	// フィールドの高さ

	var SPRITE_ONE_WIDTH = 32;		// スプライトの1画像の幅
	var SPRITE_ONE_HEIGHT = 32;	// スプライトの1画像の高さ

	var ERASE_NUM = 4;	// セルが何個つながったら消えるか

	// セル情報
	var COLOR = {
	var COLOR_NONE = 0;		// なし
	var COLOR_R = 1;		// 赤
	var COLOR_G = 2;		// 緑
	var COLOR_B = 3;		// 青
	var COLOR_Y = 4;		// 黄
	var COLOR_P = 5;		// 紫
	var COLOR_OJAMA = 6;	// おじゃま
	var COLOR_WALL = 9;		// 壁
	var COLOR_BEGIN = 1;	// 色の開始番号
	var COLOR_END = 5;		// 色の終了番号
	var COLOR_NUM = 5;		// 色数
	}
	// セル状態
	var CELL_STATUS_NORMAL = 0;	// 通常
	var CELL_STATUS_ERASE  = 1;	// 消去
	var CELL_STATUS_LIGHT  = 2;	// 明るい
	var CELL_STATUS_DARK   = 3;	// 暗い

	// 表示用
	var DRAW_DYNAMIC_INTERVAL = 50;	// 動的な表示の間隔(ms)

	var FIELD_BG_COLOR = 'rgb(255, 255, 255)';	// フィールドの背景色
	var MOVING_CELL_ALPHA = 0.8	// 移動中のセルのアルファ値
	var ERASE_CELL_ALPHA = 0.6	// 消去予定のセルのアルファ値

	// フィールドURL
	var ENCODE_CHAR = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-';
	var OCTET = 8;
	var FCODE_LENGTH = COL_NUM * ROW_NUM / 2;
	var FCODE_COL_NUM = COL_NUM / 2;

	// ---------- 設定 ----------
	// 連鎖発動タイミング
	var ERASE_TIMING_AUTO   = 1;	// 自動
	var ERASE_TIMING_MANUAL = 2;	// 手動

	var RENSA_SPEED_DEFAULT = 3;	// 連鎖スピードの初期値
	var RENSA_DIFFICULTY_DEFAULT = 3;	// 落ちコンのつながりやすさの初期値

	var REST_TIME_DEFAULT = 200;	// 残タイムの初期値
	var TIME_COUNT_DEC_INTERVAL = 100;	// 残タイムを減らす間隔(ms)

	//========== 変数 ========================================
	var cellData = [];		// セルデータ
	var cellStatus = [];	// 各セルの状態
	var cellConnect = [];	// 各セルの連結数
	for(var i = 0; i < CELL_DATA_NUM; i++){
		cellData[i] = COLOR_NONE;
		cellStatus[i] = CELL_STATUS_NORMAL;
		cellConnect[i] = 0;
	}
	for(var x = 0; x < COL_NUM; x++){
		cellData[getIndex(x, -1)] = COLOR_WALL;
		cellData[getIndex(x, ROW_NUM)] = COLOR_WALL;
	}
	for(var y = -1; y < ROW_NUM + 1; y++){
		cellData[getIndex(-1, y)] = COLOR_WALL;
		cellData[getIndex(COL_NUM, y)] = COLOR_WALL;
	}

	var rensaNum = 0;	// 連鎖数

	var touchColor = COLOR_NONE;	// タッチした色
	var touchCoord = [-1, -1];		// タッチした座標
	var blankCell = [-1, -1];		// 空白セル：cellDataの(1,1)の位置を基準にカウント

	var touchIdentifier = null;	// タッチイベントの識別子

	var drawDynamicInterval = null;	// 動的な表示の setInterval

	// 設定
	var eraseTiming = ERASE_TIMING_AUTO;	// 連鎖発動タイミング

	var rensaSpeed = RENSA_SPEED_DEFAULT;	// 連鎖スピード
	var rensaDifficulty = RENSA_DIFFICULTY_DEFAULT;	// 落ちコンのつながりやすさ

	var restTime = REST_TIME_DEFAULT;	// 残タイム
	var timeCountInterval = null;	// 残タイム表示の setInterval

	var editMode = false;				// エディット中かどうか
	var editSelectColor = COLOR_NONE;	// エディットで選択中の色

	//========== フィールド表示 ========================================
	// キャンバス生成
	var canvas = document.getElementById('field');
	var ctx = canvas.getContext('2d');

	// フィールドをクリア
	drawFieldClear();

	// 画像の読み込み
	var image = new Image();
	image.src = SPRITE_IMG;

	image.onload = function(){
		if((DEFAULT_FCODE != '') && (DEFAULT_FCODE.length == FCODE_LENGTH)){
			// フィールドコードからフィールドを生成
			makeFieldByFcode(DEFAULT_FCODE);
		} else {
			// フィールドをシャッフル
			shuffleField();
		}
	};

	//========== 関数定義 ========================================
	// スマートフォンかどうか
	function isSmartPhone(){
		if( ((navigator.userAgent.indexOf('iPhone') >= 0) && (navigator.userAgent.indexOf('iPad') == -1)) ||
		    (navigator.userAgent.indexOf('iPod') >= 0) ||
		    (navigator.userAgent.indexOf('Android') >= 0) ){
			return true;
		}

		return false;
	}

	// X座標、Y座標から配列のインデックスを取得
	function getIndex(x, y){
		return (x + 1) + (y + 1) * (COL_NUM + 2);
	}

	// 数値を指定した範囲内に収める
	function checkMinMax(num, min, max){
		return Math.min(Math.max(num, min), max);
	}

	// 色と状態を指定してスプライト画像の座標を取得
	function getSpriteCoord(color, status, connectBit){
		var posY = 0;
		switch(status){
			// 通常
			case CELL_STATUS_NORMAL:
				if((COLOR_BEGIN <= color) && (color <= COLOR_END)){
					posY = connectBit;
				}
				break;
			// 消去
			case CELL_STATUS_ERASE:
				posY = 18;
				break;
			// 明るい
			case CELL_STATUS_LIGHT:
				if((COLOR_BEGIN <= color) && (color <= COLOR_END)){
					posY = 16;
				}
				break;
			// 暗い
			case CELL_STATUS_DARK:
				if((COLOR_BEGIN <= color) && (color <= COLOR_END)){
					posY = 17;
				}
				break;
		}

		var coord = [
			[5 * (SPRITE_ONE_WIDTH + 1), 5 * (SPRITE_ONE_HEIGHT + 1)],
			[0 * (SPRITE_ONE_WIDTH + 1), posY * (SPRITE_ONE_HEIGHT + 1)],
			[1 * (SPRITE_ONE_WIDTH + 1), posY * (SPRITE_ONE_HEIGHT + 1)],
			[2 * (SPRITE_ONE_WIDTH + 1), posY * (SPRITE_ONE_HEIGHT + 1)],
			[3 * (SPRITE_ONE_WIDTH + 1), posY * (SPRITE_ONE_HEIGHT + 1)],
			[4 * (SPRITE_ONE_WIDTH + 1), posY * (SPRITE_ONE_HEIGHT + 1)],
			[5 * (SPRITE_ONE_WIDTH + 1), posY * (SPRITE_ONE_HEIGHT + 1)]
		];

		return coord[color];
	}

	// フィールドの1セルを表示
	function drawFieldCell(x, y, color, status, connectBit, alpha){
		var src = getSpriteCoord(color, status, connectBit);
		ctx.globalAlpha = alpha;
		ctx.drawImage(
			image,
			src[0], src[1], SPRITE_ONE_WIDTH, SPRITE_ONE_HEIGHT,
			CELL_WIDTH * x, CELL_HEIGHT * y, CELL_WIDTH, CELL_HEIGHT
		);
		ctx.globalAlpha = 1.0;
	}

	// 移動中のセルを表示
	function drawMovingCell(){
		if(!drawDynamicInterval){
			return;
		}
		if(touchColor == COLOR_NONE){
			return;
		}

		var src = getSpriteCoord(touchColor, CELL_STATUS_NORMAL, 0);
		ctx.globalAlpha = MOVING_CELL_ALPHA;
		ctx.drawImage(
			image,
			src[0], src[1], SPRITE_ONE_WIDTH, SPRITE_ONE_HEIGHT,
			touchCoord[0] - 41, touchCoord[1] - 90, CELL_WIDTH * 1.5, CELL_HEIGHT * 1.5
		);
		ctx.globalAlpha = 1.0;
	}

	// フィールドをクリア
	function drawFieldClear(){
		ctx.fillStyle = FIELD_BG_COLOR;
		ctx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);
	}

	// フィールドの静的な表示
	function drawFieldStatic(){
		var isRensa = ((touchColor == COLOR_NONE) && drawDynamicInterval);	// 連鎖中かどうか

		// フィールドをクリア
		drawFieldClear();

		if(!isRensa){
			// 連鎖中でないならセルの消去チェック
			checkErase(false, false);
		}

		// 画像の表示
		for(var y = 0; y < ROW_NUM; y++){
			for(var x = 0; x < COL_NUM; x++){
				var index = getIndex(x, y);
				var color = cellData[index];
				var status = cellStatus[index];
				var connectBit = 0;
				if((COLOR_BEGIN <= color) && (color <= COLOR_END) && (status != CELL_STATUS_ERASE)){
					if(color == cellData[getIndex(x, y - 1)]){
						// 上に同色のセルがある
						connectBit |= 1;
					}
					if(color == cellData[getIndex(x, y + 1)]){
						// 下に同色のセルがある
						connectBit |= 2;
					}
					if(color == cellData[getIndex(x - 1, y)]){
						// 左に同色のセルがある
						connectBit |= 4;
					}
					if(color == cellData[getIndex(x + 1, y)]){
						// 右に同色のセルがある
						connectBit |= 8;
					}
				}
				var alpha = (!isRensa && (cellConnect[index] >= ERASE_NUM)) ? ERASE_CELL_ALPHA : 1.0;
				drawFieldCell(x, y, color, status, connectBit, alpha);
			}
		}

		// 連鎖数の表示
		$('#rensaNum').html(rensaNum);
	}

	// フィールドの動的な表示
	function drawFieldDynamic(){
		drawDynamicInterval = setInterval(function(){
			// フィールドの静的な表示
			drawFieldStatic();

			// 移動中のセルを表示
			drawMovingCell();
		}, DRAW_DYNAMIC_INTERVAL);
	}

	// フィールドコードからフィールドを生成
	function makeFieldByFcode(fcode){
		for(var i = 0, len = fcode.length; i < len; i++){
			var num = Math.max(ENCODE_CHAR.indexOf(fcode.charAt(i)), 0);
			var color1 = num % OCTET;
			var color2 = Math.floor(num / OCTET);

			// 無効な値は COLOR_NONE(0) に置き換える
			if(color1 > COLOR_OJAMA){
				color1 = COLOR_NONE;
			}
			if(color2 > COLOR_OJAMA){
				color2 = COLOR_NONE;
			}

			var x = (i % FCODE_COL_NUM) * 2;
			var y = Math.floor(i / FCODE_COL_NUM);
			cellData[getIndex(x, y)]     = color1;
			cellData[getIndex(x + 1, y)] = color2;
		}

		// フィールドの静的な表示
		drawFieldStatic();
	}

	// フィールドをシャッフル
	function shuffleField(){
		while(1){
			// フィールドのセルをランダムに決定
			for(var y = 0; y < ROW_NUM; y++){
				for(var x = 0; x < COL_NUM; x++){
					cellData[getIndex(x, y)] = Math.floor(Math.random() * COLOR_NUM) + 1;
				}
			}

			if(!checkErase(true, false)){
				// 消える状態になっていなければ決定
				break;
			}
		}

		// フィールドの静的な表示
		drawFieldStatic();
	}

	// タッチした座標を取得する
	function getTouchPointInfo(e){
		// ページ内のタッチ座標
		var pageX = e.originalEvent.changedTouches[0].pageX;
		var pageY = e.originalEvent.changedTouches[0].pageY;

		// フィールドが表示されている座標
		var offsetX = $('#field').get(0).offsetLeft;
		var offsetY = $('#field').get(0).offsetTop;

		// 座標をセルに変換する
		var cell = coordToCell(pageX - offsetX, pageY - offsetY);

		return [[pageX, pageY], cell];
	}

	// クリックした座標を取得する
	function getClickPointInfo(e, offset){
		// 座標をセルに変換する
		var cell = coordToCell(e.pageX - offset.left, e.pageY - offset.top);

		return [[e.pageX, e.pageY], cell];
	}

	// 座標をセルに変換する
	function coordToCell(coordX, coordY){
		var cellX = checkMinMax(Math.floor(coordX / CELL_WIDTH), 0, COL_NUM - 1);
		var cellY = checkMinMax(Math.floor(coordY / CELL_HEIGHT), 0, ROW_NUM - 1);

		return [cellX, cellY];
	}

	// 2点のセルをなめらかに入れ替える
	function swapCell(sx, sy, dx, dy){
		if((sx == dx) && (sy == dy)){
			// 入れ替え完了
			return;
		}

		// 空白セルの移動先のターゲット座標
		var tx = sx;
		var ty = sy;

		if(Math.abs(dx - sx) >= Math.abs(dy - sy)){
			// 横に移動
			tx += ((dx > sx) ? 1 : -1);
		} else {
			// 縦に移動
			ty += ((dy > sy) ? 1 : -1);
		}

		var index = getIndex(tx, ty);
		cellData[getIndex(sx, sy)] = cellData[index];
		cellData[index] = COLOR_NONE;
		blankCell = [tx, ty];

		// 再帰呼び出し
		swapCell(tx, ty, dx, dy);
	}

	// 消去処理の間隔(ms)を取得する
	function getEraseInterval(){
		return [1000, 500, 300, 200, 100][checkMinMax(rensaSpeed, 1, 5) - 1];
	}

	// 落ちコンのつながりやすさ（確率）を取得する
	function getRensaDifficultyProb(){
		return [0.28, 0.24, 0.2, 0.16, 0.12][checkMinMax(rensaDifficulty, 1, 5) - 1];
	}

	// 連鎖チェック
	function checkRensa(isErased){
		if(checkErase(false, true)){
			// 消えるセルがある
			rensaNum++;
			setTimeout(function(){
				// 消去処理
				eraseCell();
			}, getEraseInterval());
		} else {
			// 消えるセルがない
			if(isErased){
				// 空きセルを埋める
				fillBlank();
			} else {
				// 操作完了
				moveFinish();
			}
		}
	}

	// 空きセルを埋める
	function fillBlank(){
		var prob = getRensaDifficultyProb();	// 落ちコンのつながりやすさ

		// 下の段から順番に空きセルを埋める
		for(var y = ROW_NUM - 1; y >= 0; y--){
			for(var x = 0; x < COL_NUM; x++){
				var index = getIndex(x, y);
				if(cellData[index] == COLOR_NONE){
					// 空きセル
					var underColor = cellData[getIndex(x, y + 1)];	// 下の段の色
					if((COLOR_BEGIN <= underColor) && (underColor <= COLOR_END)){
						// 下の段に色セルがあるとき
						if(prob > Math.random()){
							// 下の段と同じ色
							cellData[index] = underColor;
						} else {
							// 下の段と異なる色
							var addIndex = Math.floor(Math.random() * (COLOR_NUM - 1));
							cellData[index] = ((underColor + addIndex) % COLOR_NUM) + 1;
						}
					} else {
						// 下の段に色セルがないとき
						cellData[index] = Math.floor(Math.random() * COLOR_NUM) + 1;
					}
				}
			}
		}

		setTimeout(function(){
			// 連鎖チェック
			checkRensa(false);
		}, getEraseInterval());
	}

	// 操作完了
	function moveFinish(){
		// フィールドの動的な表示を終了
		clearInterval(drawDynamicInterval);
		drawDynamicInterval = null;

		// フィールドの静的な表示
		drawFieldStatic();
	}

	// セルの消去チェック
	function checkErase(boolCheckOnly, markErase){
		// 連結判定
		for(var i = 0; i < CELL_DATA_NUM; i++){
			cellStatus[i] = CELL_STATUS_NORMAL;
			cellConnect[i] = 0;
		}

		var isErase = false;	// 消えるセルがあるか
		for(var y = 0; y < ROW_NUM; y++){
			for(var x = 0; x < COL_NUM; x++){
				var index = getIndex(x, y);
				var color = cellData[index];
				if((COLOR_BEGIN <= color) && (color <= COLOR_END) && (cellConnect[index] == 0)){
					// まだ連結判定を行ってない色セルのみ対象
					var indexList = [];	// 連結箇所のインデックス
					var connect = _checkErase(x, y, color, indexList);
					if(connect >= ERASE_NUM){
						// このセルが消える
						isErase = true;
						if(boolCheckOnly){
							// 消えるセルがあるかどうかのチェックのみ
							return isErase;
						}
					}
					// 連結数を連結しているセル全部に反映
					for(var i = 0, len = indexList.length; i < len; i++){
						cellConnect[indexList[i]] = connect;
						if((connect >= ERASE_NUM) && markErase){
							cellStatus[indexList[i]] = CELL_STATUS_ERASE;
						}
					}
				}
			}
		}

		// おじゃまの消去チェック
		if(isErase){
			for(var y = 0; y < ROW_NUM; y++){
				for(var x = 0; x < COL_NUM; x++){
					var index = getIndex(x, y);
					if(cellData[index] != COLOR_OJAMA){
						continue;
					}

					var indexL = getIndex(x - 1, y);
					var indexR = getIndex(x + 1, y);
					var indexU = getIndex(x, y - 1);
					var indexD = getIndex(x, y + 1);
					if( ((cellData[indexL] != COLOR_OJAMA) && (cellStatus[indexL] == CELL_STATUS_ERASE)) ||
					    ((cellData[indexR] != COLOR_OJAMA) && (cellStatus[indexR] == CELL_STATUS_ERASE)) ||
					    ((cellData[indexU] != COLOR_OJAMA) && (cellStatus[indexU] == CELL_STATUS_ERASE)) ||
					    ((cellData[indexD] != COLOR_OJAMA) && (cellStatus[indexD] == CELL_STATUS_ERASE)) ){
						cellStatus[index] = CELL_STATUS_ERASE;
					}
				}
			}
		}

		return isErase;
	}
	function _checkErase(x, y, color, indexList){
		var index = getIndex(x, y);

		if(cellConnect[index] > 0){
			// 連結判定済のセルはカウントしない
			return 0;
		}
		if(color != cellData[index]){
			// 色が異なるセルはカウントしない
			return 0;
		}

		indexList.push(index);	// 連結箇所のインデックスを配列に追加
		cellConnect[index] = 1;	// チェック済みのマークとして仮の値を設定

		// 隣接セルの連結数の合計を自身の連結数とする
		var connect = 1 + 	// 自分自身
			_checkErase(x, y - 1, color, indexList) + 
			_checkErase(x, y + 1, color, indexList) + 
			_checkErase(x - 1, y, color, indexList) + 
			_checkErase(x + 1, y, color, indexList);

		cellConnect[index] = connect;	// 正式な連結数を設定

		return connect;
	}

	// 消去処理
	function eraseCell(){
		// 消えたセルの反映
		for(var y = 0; y < ROW_NUM; y++){
			for(var x = 0; x < COL_NUM; x++){
				var index = getIndex(x, y);
				if(cellStatus[index] == CELL_STATUS_ERASE){
					cellData[index] = COLOR_NONE;
					cellStatus[index] = CELL_STATUS_NORMAL;
				}
			}
		}

		// 各セルの落下数をカウント
		var dropNum = [];	// 各セルの落下数
		if(!countDrop(dropNum)){
			// 落下なしの場合
			// 空きセルを埋める
			fillBlank();
			return;
		}

		// フィールドに落下を反映
		for(var y = ROW_NUM - 1; y >= 0; y--){
			for(var x = 0; x < COL_NUM; x++){
				var index = getIndex(x, y);
				if(dropNum[index] > 0){
					cellData[getIndex(x, y + dropNum[index])] = cellData[index];
					cellData[index] = COLOR_NONE;
				}
			}
		}

		setTimeout(function(){
			// 連鎖チェック
			checkRensa(true);
		}, getEraseInterval());
	}

	// 各セルの落下数をカウントする
	function countDrop(dropNum){
		var isDrop = false;	// 落下するセルがあるか

		// 各セルの落下数を初期化する
		for(var i = 0; i < CELL_DATA_NUM; i++){
			dropNum[i] = 0;
		}

		// 下の段から順番にセルの落下数をカウントする
		for(var y = ROW_NUM - 1; y >= 0; y--){
			for(var x = 0; x < COL_NUM; x++){
				var index1 = getIndex(x, y);		// 今のセル
				var index2 = getIndex(x, y + 1);	// 一つ下のセル
				var color1 = cellData[index1];
				var color2 = cellData[index2];
				dropNum[index1] = (color2 == COLOR_NONE) ? (dropNum[index2] + 1) : dropNum[index2];
				if((color1 != COLOR_NONE) && (color2 == COLOR_NONE)){
					isDrop = true;
				}
			}
		}

		return isDrop;
	}

	//========== タッチ操作 ========================================
	// タッチ開始
	$('#field').on('touchstart', function(e){
		if(touchIdentifier != null){
			return;
		}
		touchIdentifier = e.originalEvent.changedTouches[0].identifier;

		onTouchStart(e, getTouchPointInfo(e));
	});
	$('#field').on('mousedown', function(e){
		if(typeof window.TouchEvent == 'object'){
			return;
		}
		onTouchStart(e, getClickPointInfo(e, $(this).offset()));
	});

	// タッチ移動中
	$('#field').on('touchmove', function(e){
		if(touchIdentifier != e.originalEvent.changedTouches[0].identifier){
			return;
		}

		onTouchMove(e, getTouchPointInfo(e));
	});
	$('#field').on('mousemove', function(e){
		if(typeof window.TouchEvent == 'object'){
			return;
		}
		onTouchMove(e, getClickPointInfo(e, $(this).offset()));
	});

	// タッチ終了
	$('#field').on('touchend', function(e){
		if(touchIdentifier != e.originalEvent.changedTouches[0].identifier){
			return;
		}
		touchIdentifier = null;

		onTouchEnd(e, getTouchPointInfo(e));
	});
	$('#field').on('mouseup', function(e){
		if(typeof window.TouchEvent == 'object'){
			return;
		}
		onTouchEnd(e, getClickPointInfo(e, $(this).offset()));
	});

	// タッチ開始
	function onTouchStart(e, pointInfo){
		if((touchColor != COLOR_NONE) || drawDynamicInterval || editMode){
			// 移動中または連鎖中またはエディット中である
			return;
		}

		var index = getIndex(pointInfo[1][0], pointInfo[1][1]);
		if((cellData[index] == COLOR_NONE) || (cellData[index] == COLOR_OJAMA)){
			// 空白セル、おじゃまは移動できない
			return;
		}

		blankCell = [pointInfo[1][0], pointInfo[1][1]];
		touchCoord = [pointInfo[0][0], pointInfo[0][1]];
		touchColor = cellData[index];
		cellData[index] = COLOR_NONE;

		// 連鎖数を0に戻す
		rensaNum = 0;

		// フィールドの動的な表示
		drawFieldDynamic();
	}

	// タッチ移動中
	function onTouchMove(e, pointInfo){
		if(touchColor == COLOR_NONE){
			// 移動中でない
			return;
		}

		touchCoord = [pointInfo[0][0], pointInfo[0][1]];

		if((blankCell[0] != pointInfo[1][0]) || (blankCell[1] != pointInfo[1][1])){
			// 入れ替え
			swapCell(blankCell[0], blankCell[1], pointInfo[1][0], pointInfo[1][1]);
		}
	}

	// タッチ終了
	function onTouchEnd(e, pointInfo){
		if(editMode){
			// エディット中
			if(editSelectColor != COLOR_NONE){
				// 色が選択されている
				cellData[getIndex(pointInfo[1][0], pointInfo[1][1])] = editSelectColor;

				// フィールドの静的な表示
				drawFieldStatic();
			}
			return;
		}
		if(touchColor == COLOR_NONE){
			// 移動中でない
			return;
		}

		var index = getIndex(blankCell[0], blankCell[1]);

		blankCell = [-1, -1];
		cellData[index] = touchColor;
		touchColor = COLOR_NONE;

		if(eraseTiming == ERASE_TIMING_AUTO){
			// 連鎖チェック
			checkRensa(false);
		} else {
			// 操作完了
			moveFinish();
		}
	}

	//========== ボタン処理操作 ========================================
	// ---------- フィールド ----------
	// フィールドウィンドウを表示
	$('#fieldButton').on('click', function(e){
		if((touchColor != COLOR_NONE) || drawDynamicInterval){
			// 移動中または連鎖中である
			return;
		}

		$('#fieldWindow').show();
	});

	// フィールドウィンドウを消去
	$('#hideFieldButton').on('click', function(e){
		$('#fieldWindow').hide();

		// アドレスバーを隠す
		hideAddressBar();
	});

	// 連鎖発動タイミングの切り替え
	$('#eraseTiming1').on('click', function(e){
		// 手動→自動
		$('#checkRensaButton').addClass('disabled').removeClass('btn-primary').addClass('btn-default');
		eraseTiming = ERASE_TIMING_AUTO;
		setLocalStorage('eraseTiming', ERASE_TIMING_AUTO);
	});
	$('#eraseTiming2').on('click', function(e){
		// 自動→手動
		$('#checkRensaButton').removeClass('disabled').addClass('btn-primary').removeClass('btn-default');
		eraseTiming = ERASE_TIMING_MANUAL;
		setLocalStorage('eraseTiming', ERASE_TIMING_MANUAL);
	});

	// 連鎖発動（手動時のみ）
	$('#checkRensaButton').on('click', function(e){
		if(eraseTiming != ERASE_TIMING_MANUAL){
			return;
		}

		// フィールドウィンドウを消去
		$('#fieldWindow').hide();

		// 連鎖数を0に戻す
		rensaNum = 0;

		// フィールドの動的な表示
		drawFieldDynamic();

		setTimeout(function(){
			// 連鎖チェック
			checkRensa(false);
		}, 300);
	});

	// フィールド状態の保存
	$('#backupFieldButton').on('click', function(e){
		$('#restoreFieldButton').removeClass('disabled').addClass('btn-primary').removeClass('btn-default');

		// 保存処理
		setLocalStorage('cellDataBackup', cellData.join(','));

		// フィールドウィンドウを消去
		$('#fieldWindow').hide();
	});

	// フィールド状態の復元
	$('#restoreFieldButton').on('click', function(e){
		// 復元処理
		cellData = getLocalStorage('cellDataBackup').split(',');
		for(var i = 0; i < CELL_DATA_NUM; i++){
			// 文字列型になっているのを数値型に変換する
			cellData[i] = parseInt(cellData[i]);
		}

		// 連鎖数を0に戻す
		rensaNum = 0;

		// フィールドの静的な表示
		drawFieldStatic();

		// フィールドウィンドウを消去
		$('#fieldWindow').hide();
	});

	// 色変化：青 ⇒ 赤
	$('#changeColorRedButton').on('click', function(e){
		changeColorCommon(COLOR_B, COLOR_R);
	});
	// 色変化：緑 ⇒ 青
	$('#changeColorBlueButton').on('click', function(e){
		changeColorCommon(COLOR_G, COLOR_B);
	});
	// 色変化：赤 ⇒ 緑
	$('#changeColorGreenButton').on('click', function(e){
		changeColorCommon(COLOR_R, COLOR_G);
	});
	// 色変化：紫 ⇒ 黄
	$('#changeColorYellowButton').on('click', function(e){
		changeColorCommon(COLOR_P, COLOR_Y);
	});
	// 色変化：黄 ⇒ 紫
	$('#changeColorPurpleButton').on('click', function(e){
		changeColorCommon(COLOR_Y, COLOR_P);
	});

	// 色変化の共通処理
	function changeColorCommon(srcColor, dstColor){
		// フィールドウィンドウを消去
		$('#fieldWindow').hide();

		// 連鎖数を0に戻す
		rensaNum = 0;

		// 色の変化が見えるように遅らせて処理する
		setTimeout(function(){
			// 色変化
			for(var y = 0; y < ROW_NUM; y++){
				for(var x = 0; x < COL_NUM; x++){
					var index = getIndex(x, y);
					if(cellData[index] == srcColor){
						cellData[index] = dstColor;
					}
				}
			}

			// フィールドの静的な表示
			drawFieldStatic();
		}, 100);
	}

	// 20秒カウント
	$('#count20Button').on('click', function(e){
		// フィールドウィンドウを消去
		$('#fieldWindow').hide();

		// 連鎖数を0に戻す
		rensaNum = 0;

		// 残タイムを初期値にする
		clearInterval(timeCountInterval);
		restTime = REST_TIME_DEFAULT;
		drawTimeCount();

		// 少し遅らせてカウント開始する
		setTimeout(function(){
			timeCountInterval = setInterval(function(){
				decTimeCount();
			}, TIME_COUNT_DEC_INTERVAL);
		}, 100);
	});

	// 残タイムを表示
	function drawTimeCount(){
		var timeCount = Math.floor(restTime / 10) + '.' + (restTime % 10);
		$('#timeCount').html(timeCount);
	}

	// 残タイムを減らす
	function decTimeCount(){
		restTime--;
		drawTimeCount();
		if(restTime == 0){
			// 0になったら終了
			clearInterval(timeCountInterval);
		}
	}

	// ---------- エディット ----------
	// エディットウィンドウを表示
	$('#editButton').on('click', function(e){
		if((touchColor != COLOR_NONE) || drawDynamicInterval){
			// 移動中または連鎖中である
			return;
		}

		editMode = true;	// エディット開始

		$('#editWindow').show();
	});

	// エディットウィンドウを消去
	$('#hideEditButton').on('click', function(e){
		editMode = false;	// エディット終了

		$('#editWindow').hide();

		// アドレスバーを隠す
		hideAddressBar();
	});

	// エディットの色を選択
	$('.editSelectBox').on('click', function(e){
		editSelectColor = parseInt($(this).attr('data-color'));
		$('.editSelectBox').css('background-color', '');
		$(this).css('background-color', '#fff');
	});

	// ---------- 設定 ----------
	// 設定ウィンドウを表示
	$('#settingsButton').on('click', function(e){
		if((touchColor != COLOR_NONE) || drawDynamicInterval){
			// 移動中または連鎖中である
			return;
		}

		// フィールドURLを生成する
		makeFieldUrl();

		$('#settingsWindow').show();
	});

	// 設定ウィンドウを消去
	$('#hideSettingsButton').on('click', function(e){
		$('#settingsWindow').hide();

		// アドレスバーを隠す
		hideAddressBar();
	});

	// 連鎖スピードの切り替え
	$('input[name=rensaSpeed]').on('click', function(e){
		var val = $(this).val();
		rensaSpeed = val;
		setLocalStorage('rensaSpeed', val);
	});

	// 落ちコンのつながりやすさ
	$('input[name=rensaDifficulty]').on('click', function(e){
		var val = $(this).val();
		rensaDifficulty = val;
		setLocalStorage('rensaDifficulty', val);
	});

	// フィールドURLの生成
	function makeFieldUrl(){
		var fcode = '';
		for(var y = 0; y < ROW_NUM; y++){
			for(var x = 0; x < COL_NUM; x += 2){
				var color1 = cellData[getIndex(x, y)];
				var color2 = cellData[getIndex(x + 1, y)];
				fcode += ENCODE_CHAR.charAt(color1 + color2 * OCTET);
			}
		}

		$('#fieldUrl').attr('href', BASE_URL + fcode);
	}

	// ---------- 情報 ----------
	// 情報ウィンドウを表示
	$('#infoButton').on('click', function(e){
		if((touchColor != COLOR_NONE) || drawDynamicInterval){
			// 移動中または連鎖中である
			return;
		}

		$('#infoWindow').show();
	});

	// 情報ウィンドウを消去
	$('#infoWindow').on('click', function(e){
		$('#infoWindow').hide();

		// アドレスバーを隠す
		hideAddressBar();
	});

	// ---------- リセット ----------
	// リセット
	$('#resetButton').on('click', function(e){
		location.reload();
	});

	//========== トグルスイッチ ========================================
	$("p.switch label").click(function(){
		var parent = $(this).closest('p.switch');
		$('label', parent).removeClass('selected');
		$(this).addClass('selected');
		$('input', parent).removeAttr('checked');
		$('#' + $(this).attr('for')).attr('checked', true);
	});

	//========== 表示 ========================================
	if(isSmartPhone()){
		// スマートフォンである
		$('.forPC').hide();
		$('.forSP').show();
	} else {
		// スマートフォンでない
		$('.forPC').show();
		$('.forSP').hide();
	}

	//========== localStorage処理 ========================================
	// setItem
	function setLocalStorage(key, value){
		localStorage.setItem(key, value);
	}

	// getItem
	function getLocalStorage(key){
		return localStorage.getItem(key);
	}

	// removeItem
	function removeLocalStorage(key){
		localStorage.removeItem(key);
	}

	// 連鎖発動タイミングの設定
	var eraseTimingLocal = getLocalStorage('eraseTiming');
	if((eraseTimingLocal != null) && (eraseTimingLocal == ERASE_TIMING_MANUAL)){
		// 自動→手動
		eraseTiming = eraseTimingLocal;
		$('label[for=eraseTiming2]').click();
		$('#checkRensaButton').removeClass('disabled').addClass('btn-primary').removeClass('btn-default');
	}

	// フィールド状態
	var cellDataBackupLocal = getLocalStorage('cellDataBackup');
	if((cellDataBackupLocal != null) && (cellDataBackupLocal != '')){
		// 復元処理
		$('#restoreFieldButton').removeClass('disabled').addClass('btn-primary').removeClass('btn-default');
	}

	// 連鎖スピード
	var rensaSpeedLocal = getLocalStorage('rensaSpeed');
	if((rensaSpeedLocal != null) && (rensaSpeedLocal != RENSA_SPEED_DEFAULT)){
		rensaSpeed = rensaSpeedLocal;
		$('label[for=rensaSpeed' + rensaSpeedLocal + ']').click();
	}

	// 落ちコンのつながりやすさ
	var rensaDifficultyLocal = getLocalStorage('rensaDifficulty');
	if((rensaDifficultyLocal != null) && (rensaDifficultyLocal != RENSA_SPEED_DEFAULT)){
		rensaDifficulty = rensaDifficultyLocal;
		$('label[for=rensaDifficulty' + rensaDifficultyLocal + ']').click();
	}
});

	//========== スクロール禁止 ==================================================
	function preventScroll(event){
		// 特定の操作は抑止しない
		var target = event.touches[0].target;
		var tagName = target.tagName.toLowerCase();
		var id = target.id;

		if((event.type == 'touchstart') && (tagName == 'a')){
			return;
		}
		if((event.type == 'touchstart') && (tagName == 'input')){
			return;
		}

		if((event.type == 'touchstart') && (id == 'infoWindow')){
			return;
		}
		if((event.type == 'touchstart') && $(target).find('#infoWindow')){
			return;
		}

		// preventDefaultでブラウザ標準動作を抑止する
		event.preventDefault();
	}

	// タッチイベントの初期化
	document.addEventListener('touchstart', preventScroll, false);
	document.addEventListener('touchmove', preventScroll, false);
	document.addEventListener('touchend', preventScroll, false); 

	// ジェスチャーイベントの初期化
	document.addEventListener('gesturestart', preventScroll, false);
	document.addEventListener('gesturechange', preventScroll, false);
	document.addEventListener('gestureend', preventScroll, false);

	// アドレスバーを隠す
	function hideAddressBar() {
		setTimeout('scrollTo(0,1)', 1);
	}
	window.onload = function(){
		hideAddressBar();
	};
