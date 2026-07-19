
//============================================================
// Piano Core (free play)
//============================================================

//@TODO: save options to local storage (volume, background)

let kbBindings = {};
let modifier = "regul";	// regul | lower | upper

let audioMap = {};

let volume = 0.5;

let backgrounds = [
	{ url:"img/bg1.avif", logo:"dark", blur:true },
	{ url:"img/bg2.avif", logo:"dark", blur:true },
	//{ url:"img/bg3.avif", logo:"light", credit:"https://steamcommunity.com/sharedfiles/filedetails/?id=3403239559" },
	//{ url:"img/bg4.avif", logo:"dark", blur:true },
	//{ url:"img/bg5.avif", logo:"dark", blur:true },
];

$(document).ready(() => {

	// NOTE: We cannot load custom binary in local mode, so we still need individual sound files to fallback to.
	if (window.location.href.startsWith('file://')) {

		// Load individual sound files
		$('.key').each((i,elem) => {
			let audioKey = $(elem).data('audio');
			audioMap[audioKey] = new Audio(resolveAudioUri(audioKey));
		});

	}
	else {

		// Load sounds package
		const req = new XMLHttpRequest();
		req.open("GET", 'audio/pack01', true);
		req.responseType = 'arraybuffer';
		req.onload = (event) => {
			if (req.response) {
				let buf = buffer.Buffer.from(req.response);

				buf.myOffset = 0;
				buf.readUInt32 = function() {
					this.myOffset += 4;
					return this.readUInt32LE(this.myOffset-4);
				}
				buf.readShortString = function() {
					let len = this.readUInt8(this.myOffset);
					this.myOffset += 1+len;
					return (len > 0) ? this.toString('utf8', this.myOffset-len, this.myOffset) : "";
				}
				buf.readArrayBuffer = function() {
					let size = this.readUInt32();
					this.myOffset += size;
					return this.buffer.slice(this.myOffset-size, this.myOffset);
				}

				// 1. number of sounds
				let numSounds = buf.readUInt32();
				console.log("numSounds", numSounds);

				// 2. for each element
				for (let i=0; i<numSounds; i++) {
					// 2.1. sound name
					let name = buf.readShortString();
					console.log("fileName", name);

					// 2.2. audio data (as arraybuffer)
					let data = buf.readArrayBuffer();
					console.log("data", data);

					// Create blob with a local URL (alternatively could use data-url, not sure what is best)
					let blob = new Blob([data], {type:'audio/mp3'});
					let url = URL.createObjectURL(blob);

					// Bind it
					audioMap[name] = new Audio(url);
				}
			}
		};
		req.send(null);

	}

	$('.piano').on('mousedown', '.key', triggerKey);

	$('.key').each((i,elem) => {
		let bind = $(elem).data('bind');
		kbBindings[bind] = elem;
	});

	$(window).on('keydown keyup', (event) => {
		if (event.shiftKey)
			modifier = "upper";
		else if (event.ctrlKey)
			modifier = "lower";
		else
			modifier = "regul";

		updateShowBinds(modifier);
	});
	updateShowBinds(modifier);

	$(window).on('keydown', (event) => {
		if (!event.originalEvent.repeat) {
			let bind = modifier+"-"+event.originalEvent.code;
			if (kbBindings[bind])
				triggerKey.call(kbBindings[bind]);
		}
		// prevent stuff like ctrl+A, ctrl+R
		if (kbBindings["regul-"+event.originalEvent.code])
			return false;
	});

	$(window).on('mousewheel', (event) => {
		if (event.originalEvent.wheelDeltaY > 0)
			volume = Math.min(1, volume+0.05);
		else if (event.originalEvent.wheelDeltaY < 0)
			volume = Math.max(0, volume-0.05);
		$('.volume').text(Math.round(volume*100));
	});

	toggleBackground($('.cb-bg').is(':checked'));

});

function resolveAudioUri(key) {
	return "audio/"+key+".mp3";
}

let showingBinds;
function updateShowBinds(modifier) {
	if (modifier != showingBinds) {
		$('.key b').addClass('d-none');
		$('.key[data-bind^="'+modifier+'-"] b').removeClass('d-none');
		showingBinds = modifier;
	}
}

// this = key element
function triggerKey() {
	//console.log(this);

	let audioKey = $(this).data('audio');
	let sound = audioMap[audioKey].cloneNode();
	sound.volume = volume;
	sound.play();

	$(this).addClass('trigger');

	clearTimeout(this.hlTimeout);
	this.hlTimeout = setTimeout(() => {
		$(this).removeClass('trigger');
	}, 30);
}

function toggleBackground(enable) {
	$('.key').css('backdrop-filter', '');
	$('.bg-credit').empty();

	if (enable) {
		let bg = backgrounds[Math.floor(backgrounds.length*Math.random())];
		$('.background').css('background-image', 'url('+bg.url+')');
		$('.wwm-logo').attr('src', 'img/wwm-'+bg.logo+'.webp');
		if (bg.blur)
			$('.key').css('backdrop-filter', 'blur(2px)');
		if (bg.credit)
			$('.bg-credit').html('<a href="'+bg.credit+'" target="_blank"><i class="fa fa-link mr-1"></i>background</a>');
	}
	else {
		$('.background').css('background-image', '');
		//$('.wwm-logo').attr('src', 'img/wwm-light.webp');
	}
}


//============================================================
// Sheet/gaming mode
//============================================================

//@DONE: [SETTINGS] configurable gamesheet "length" (in seconds = time to see the notes incoming)
//@DONE: [FEATURE] pause/rewind/seek
//@DONE: [FEATURE] configurable playback speed
//@DONE: [FEATURE] configurable shift
//@DONE: [SETTINGS] configurable incoming note hint style (eg. outside circle, inside circle, flash)
//@DONE: [SETTINGS] configurable incoming note hint delay (how long it appears before it needs to be hit)
//@DONE: [FEATURE] autoplay option to preview music

//@TODO: [FEATURE] support notes colorization in file format
//@TODO: [QOL] auto save settings

//@TODO: [FEATURE] macro recording + export sheet
//@TODO: [FEATURE] fixup timestamps after recording

$(document).ready(() => {

	$('body').setupDragDrop({
		validateFn: (type) => type.startsWith('text/'),
		callbackFn: (event, file) => onFile(file),
	});

	// Generate sheet columns
	{
		let html = '';
		for (let i=0; i<12; i++) {
			html += '<div class="range">';
			for (let j=0; j<3; j++)
				html += '<div class="col"></div>';
			html += '</div>';
		}
		$('.gamesheet .pianorow').html(html);
	}

	// Setup track slider
	{
		$('.gametrack').on('mousedown', function(event) {
			event.preventDefault();
			const bar = $(this).find('.bar');
			const cursor = $(this).find('.cursor');
			function mousemove(event) {
				event.preventDefault();
				let f = clamp((event.clientX - bar.offset().left) / bar.width(), 0, 1);
				gameState.seek(f * gameSheet.lastTs);
			}
			gameState.pause();
			mousemove(event);
			$(window).on('mousemove', mousemove);
			$(window).one('mouseup', function(event) {
				event.preventDefault();
				$(window).off('mousemove', mousemove);
			});
		});
	}

	// Keybinds
	$(window).on('keydown', function(event) {
		switch (event.originalEvent.code) {
			case 'Space': gameState.togglePlay(); return false;
			case 'ArrowLeft': gameState.seek(gameState.ts-1000); return false;
			case 'ArrowRight': gameState.seek(gameState.ts+1000); return false;
			case 'Backspace': gameState.seek(0); return false;
		}
		return true;
	});

	// Avoid processing binds when in settings pane
	$('.gamesettings').on('keydown mousewheel', function(event) {
		event.stopPropagation();
	});

	$('.gamesettings textarea').on('change', function() {
		parseSheetText(this.value);
	});

	gameSettings = new GameSettings();
	gameSheet = new GameSheet();
	gameState = new GameState();
});

function openSettings() {
	$('.gamesettings').addClass('visible').attr('tabindex', '0').focus();
}
function closeSettings() {
	$('.gamesettings').removeClass('visible').attr('tabindex', '');
	document.activeElement.blur();
}

let gameSettings;
let gameSheet;
let gameState;

function onFile(file) {
	readFileAs(file, 'text')
	.then(text => $('.gamesettings textarea').val(text).change())
	.catch(commonErrorHandler);
}

/**
 * File format = one instruction per line
 * One line = one timestamp (milliseconds) + one or several notes
 * Notes are coded from 1 to 36 like the piano
 * Extra lines and spaces and leading zeroes can be added for readability
 * Lines starting with // are ignored (comments)
 * Timestamps don't have to be ordered, and can be duplicate
 * Example:
 
// First part
   0 26
 400 28
 800 29
1200 26 29

// Second part
1600 29
2000 28
2400 26
2800 26 29

*/
function parseSheetText(text) {
	gameSheet = new GameSheet();

	let lines = text.split(/[\r\n]+/);

	for (let line of lines) {
		line = line.trim();
		if (!line)
			continue;

		let words = line.split(/\s+/);

		if (words[0].startsWith('//'))
			continue;

		let timestamp = parseInt(words[0]);
		for (let i=1; i<words.length; i++)
			gameSheet.push(new Note(timestamp, parseInt(words[i])));
	}

	gameSheet.finalize();
	gameState.reset();
}

const CHR_LOWER = '⌄';	//U+2304
const CHR_UPPER = '⌃';	//U+2303

class Note {
	constructor(timestamp, code) {
		this.ts = timestamp;
		this.originalCode = code;
		this.setCode(code);
	}

	setCode(code) {
		this.code = code;

		if (code < 0 || code > 36)	// Notes become 0 when shifted away from range - discard them
			this.code = 0;

		//this.column = (code-1) % 12;
		this.column = 3*((this.code-1)%12) + Math.floor((this.code-1)/12);

		this.label = [
			'',
			'W', CHR_UPPER+'W', 'X', CHR_LOWER+'C', 'C', 'V', CHR_UPPER+'V', 'B', CHR_UPPER+'B', 'N', CHR_LOWER+'M', 'M',
			'A', CHR_UPPER+'A', 'S', CHR_LOWER+'D', 'D', 'F', CHR_UPPER+'F', 'G', CHR_UPPER+'G', 'H', CHR_LOWER+'H', 'J',
			'Q', CHR_UPPER+'Q', 'Z', CHR_LOWER+'E', 'E', 'R', CHR_UPPER+'R', 'T', CHR_UPPER+'T', 'Y', CHR_LOWER+'Y', 'U',
		][this.code];

		this.$ = $('.key[data-audio="' + ("0"+this.code).slice(-2) + '"]');
	}

	toString() {
		return ("000000"+this.ts).slice(-6) + " " + ("0"+this.code).slice(-2);
	}
}

// Array of Note
class GameSheet extends Array {
	constructor() {
		super();
		this.lastTs = 1000;	//dummy
	}
	finalize() {

		// Sort notes by timestamp
		this.sort((a,b) => a.ts - b.ts || a.column - b.column || a.code - b.code);

		// Make sure the first note is always at InitialDelay
		if (this[0] && this[0].ts != gameSettings.initialDelay) {
			let shift = gameSettings.initialDelay - this[0].ts;
			for (let item of this)
				item.ts += shift;
		}

		// Save the last timestamp (= track duration)
		this.lastTs = this[this.length-1].ts || 1000;

		// Build a reverse lookup map to quickly find notes by timestamp
		// we'll use an array where indices are seconds (timestamp/1000) and value is the next note index
		this.timeTable = [];
		let nextIndex = 0;
		for (let currentSecond=0; currentSecond<=this.lastTs/1000; currentSecond++) {
			while (this[nextIndex].ts/1000 < currentSecond)
				nextIndex++;
			this.timeTable[currentSecond] = nextIndex;
		}

		$('body').toggleClassHelper(this.length > 0, 'gaming', '');
		$('.controls').toggleClassHelper(this.length > 0, 'fa-cog', 'fa-file-audio', true);
	}
}

class GameSettings {
	constructor() {
		this.reset();
	}

	reset() {
		// Game sheet visible length in milliseconds
		this.setSheetVisibleLength(3000);

		// Initial delay before first note
		this.initialDelay = 3000;

		// Playback speed
		this.setSpeed(1.0);

		// Shift all notes by amount
		this.setShift(0);

		this.setNoteHintStyle('ring-ext');
		this.setNoteHintDuration(1000);

		// Automatically play notes (preview music)
		this.setAutoPlay(false);
	}

	setSheetVisibleLength(val) {
		this.sheetVisibleLength = clamp(val, 500, 10000);
		$('.sheetVisibleLength').val(this.sheetVisibleLength);
		gameState && gameState.renderSheet();
	}

	setSpeed(val) {
		this.speed = clamp(val, 0.1, 8.0);
		$('.gamesettings .speed').val(Math.round(this.speed*100));
	}

	setShift(val) {
		this.shift = clamp(val, -24, 24);
		$('.gamesettings .shift').val(this.shift);
		if (gameSheet) {
			for (let note of gameSheet)
				note.setCode(note.originalCode + this.shift);
			gameState.renderSheet();
		}
	}

	setNoteHintStyle(val) {
		this.noteHintStyle = val;
		$('.noteHintStyle').val(this.noteHintStyle);
	}

	setNoteHintDuration(val) {
		this.noteHintDuration = clamp(val, 100, 2000);
		$('.noteHintDuration').val(this.noteHintDuration);
	}

	setAutoPlay(val) {
		this.autoPlay = val;
		$('.gamesettings .autoPlay')[0].checked = this.autoPlay;
	}
}

class GameState {
	constructor() {
		this.$cursor = $('.gametrack .cursor');
		this.$sheet = $('.gamesheet');
		this.canvas = this.$sheet.find('canvas')[0];

		this.reset();
	}

	reset() {
		this.pause();
		this.seek(0);
	}

	play() {
		this.playing = true;
		this.previousTs = performance.now();
		this.animFrameID = requestAnimationFrame(this.tick.bind(this));
		$('.controls').toggleClassHelper(this.playing, 'fa-pause', 'fa-play', true);
	}

	pause() {
		cancelAnimationFrame(this.animFrameID);
		this.playing = false;
		$('.controls').toggleClassHelper(this.playing, 'fa-pause', 'fa-play', true);
	}

	togglePlay() {
		if (this.playing)
			this.pause();
		else if (this.ts >= gameSheet.lastTs)
			this.playFromStart();
		else
			this.play();
	}

	playFromStart() {
		this.reset();
		this.play();
	}

	seek(newTs) {
		this.ts = clamp(newTs, 0, gameSheet.lastTs);
		this.$cursor.css('width', (this.ts/gameSheet.lastTs)*100 + '%');
		this.renderSheet();
	}

	tick(browserTs) {
		let dt = browserTs - this.previousTs;
		dt *= gameSettings.speed;

		if (dt > 0) {
			this.seek(this.ts + dt);

			// Note: we use CSS animations for note hints
			// cannot get them proper while paused/seeking
			// so we detect and play them here instead of within seek()
			this.renderNoteHints(this.ts-dt, this.ts);

			this.handleAutoPlay(this.ts-dt, this.ts);
		}

		if (this.ts >= gameSheet.lastTs) {
			this.pause();
			return;
		}

		this.previousTs = browserTs;
		this.animFrameID = requestAnimationFrame(this.tick.bind(this));
	}

	renderSheet() {
		const canvas = this.canvas;
		canvas.width = this.$sheet.width();
		canvas.height = this.$sheet.height();

		const ctx = canvas.getContext('2d');
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		
		if (!gameSheet.length)
			return;

		const columnsPosX = this.$sheet.find('.col').map((i, elem) => (elem.offsetLeft-canvas.offsetLeft)+elem.offsetWidth/2);

		ctx.strokeStyle = '#0000';
		ctx.lineWidth = 1;
		ctx.font = 'bold 15px Helvetica';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		const NOTE_SIZE = 28;

		const timeIndex = Math.floor(this.ts/1000);
		for (let i=gameSheet.timeTable[timeIndex]; i<gameSheet.length; i++) {
			const note = gameSheet[i];
			if (note.ts < this.ts)
				continue;
			if (note.ts > this.ts + gameSettings.sheetVisibleLength)
				break;

			let posX = columnsPosX[note.column];
			let posY = canvas.height - canvas.height * ((note.ts - this.ts) / gameSettings.sheetVisibleLength);

			ctx.fillStyle = '#fff';
			ctx.beginPath();
			ctx.arc(posX, posY, NOTE_SIZE/2, NOTE_SIZE/2, 0, 2*Math.PI);
			ctx.fill();
			ctx.stroke();

			ctx.fillStyle = '#000';
			ctx.fillText(note.label, posX, posY+1);
		}
	}

	renderNoteHints(previousTs, currentTs) {
		if (!gameSettings.noteHintStyle)
			return;

		// Figure out which hints to spawn
		// Hint duration is not affected by speed, but the moment to spawn them is !

		const spawnTsMin = previousTs + gameSettings.noteHintDuration*gameSettings.speed;
		const spawnTsMax = currentTs + gameSettings.noteHintDuration*gameSettings.speed;

		const timeIndex = Math.floor(spawnTsMin/1000);
		for (let i=gameSheet.timeTable[timeIndex]; i<gameSheet.length; i++) {
			const note = gameSheet[i];
			if (note.ts > spawnTsMax)
				break;
			if (note.ts > spawnTsMin) {
				let $hint = $('<div class="'+gameSettings.noteHintStyle+'"></div>').appendTo(note.$);
				if (gameSettings.noteHintStyle != 'flash')
					$hint.css('animation-duration', gameSettings.noteHintDuration+'ms');
				registerNoteHintForDeletion($hint, gameSettings.noteHintDuration);
			}
		}
	}

	handleAutoPlay(previousTs, currentTs) {
		if (!gameSettings.autoPlay)
			return;

		const timeIndex = Math.floor(previousTs/1000);
		for (let i=gameSheet.timeTable[timeIndex]; i<gameSheet.length; i++) {
			const note = gameSheet[i];
			if (note.ts > currentTs)
				break;
			if (note.ts > previousTs)
				triggerKey.call($('[data-audio="'+("0"+note.code).slice(-2)+'"]')[0]);
		}
	}
}

// Array of array of elements, first row is always the next one being deleted, process once per second
const noteHintsToDelete = [];

function registerNoteHintForDeletion($elem, duration) {
	let index = Math.ceil(duration/1000);
	while (noteHintsToDelete.length <= index)
		noteHintsToDelete.push([]);
	noteHintsToDelete[index].push($elem);
}

function deleteNoteHints() {
	if (noteHintsToDelete.length) {
		for (let $elem of noteHintsToDelete[0])
			$elem.remove();
		noteHintsToDelete.shift();
	}
}

setInterval(deleteNoteHints, 1000);


//============================================================
// Utilities
//============================================================

function clamp(val,min,max) {
	return Math.min(Math.max(val,min),max);
}

$.fn.toggleClassHelper = function(b, classTrue, classFalse, bFindInChildren) {
	let elem = bFindInChildren ? this.find('.'+(b?classFalse:classTrue)) : this;
	elem.removeClass(b?classFalse:classTrue).addClass(b?classTrue:classFalse);
	return this;
}

$.fn.setupDragDrop = function(subSelector, options) {
	if (options === undefined) {
		options = subSelector;
		subSelector = undefined;
	}
	if (typeof(options) == 'function')
		options = { callback: options };
	if (!options || !options.callbackFn)
		throw new Error("setupDragDrop: callbackFn required");

	return this.on('dragenter dragover', subSelector || undefined, function(event) {
		event.preventDefault();
		if (options.enabledFn && !options.enabledFn.call(this))
			return;

		clearTimeout(this.dropTimeout);
		if (event.originalEvent.dataTransfer.items && options.validateFn && !options.validateFn.call(this, event.originalEvent.dataTransfer.items[0].type))
			$(this).addClass('dropfail');
		else
			$(this).addClass('dropok');
	})
	.on('dragleave', subSelector || undefined, function(event) {
		event.preventDefault();
		clearTimeout(this.dropTimeout);
		// Use delay to avoid jitter when passing over child elements
		this.dropTimeout = setTimeout(() => $(this).removeClass('dropok dropfail'), 50);
	})
	.on('drop', subSelector || undefined, function(event) {
		event.preventDefault();
		clearTimeout(this.dropTimeout);
		$(this).removeClass('dropok dropfail');

		if (options.enabledFn && !options.enabledFn.call(this))
			return;

		if (event.originalEvent.dataTransfer.items) {
			// Use DataTransferItemList interface to access the file
			let item = event.originalEvent.dataTransfer.items[0];
			if (item.kind === 'file' && (!options.validateFn || options.validateFn.call(this, item.type)))
				options.callbackFn.call(this, event, item.getAsFile());
		}
		else {
			// Use DataTransfer interface to access the file
			let file = event.originalEvent.dataTransfer.files[0];
			if (!options.validateFn || options.validateFn.call(this, file.type))
				options.callbackFn.call(this, event, file);
		}
	});
}

function readFileAs(file, asType) {
	return new Promise((resolve, reject) => {
		if (!file)
			return reject("readFileAs: no file");

		const reader = new FileReader();
		reader.onload = function(event) {
			if (event.target.readyState == FileReader.DONE)
				resolve(event.target.result);
			else
				console.log("readyState?!", event.target.readyState);
		};
		reader.onerror = reject;
		if (asType == 'dataURL')
			reader.readAsDataURL(file);
		else if (asType == 'text')
			reader.readAsText(file);
		else if (asType == 'arrayBuffer')
			reader.readAsArrayBuffer(file);
		else
			reject("readFileAs: type must be 'dataURL' or 'text' or 'arrayBuffer'");
	});
}

function commonErrorHandler(err) {
	console.error(err);
	err = translateError(err);
	return bootbox.alert({
		message: '<div class="bootbox-title">' + err.title + '</div>' + err.body,
		buttons: { ok:{className:'btn-danger'} },
	});
}
function translateError(err) {
	// no error information
	if (!err)
		return { title: "ERROR", body: "Unknown error" };

	// script error (exception)
	if (err.stack) {
		return {
			title: "Application Error",
			body: [
				"An internal application error occured",
				err.name,
				err.message,
				'<pre>' + err.stack + '</pre>',
			].join('<br>')
		};
	}

	// script thrown message
	if (typeof(err) == 'string')
		return { title: "ERROR", body: err };

	// unknown
	return { title: "ERROR", body: "Unknown error" };
}
