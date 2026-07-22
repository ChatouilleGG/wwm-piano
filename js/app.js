
//============================================================
// Piano Core (free play)
//============================================================

let $piano;

let kbBindings = {};
let modifier = "regul";	// regul | lower | upper

class PianoKey {
	constructor($, name, audio) {
		this.$ = $;
		this.name = name;
		this.code = parseInt(name);
		this.audio = audio;
	}
}
// map key name to PianoKey object
let pianoMap = {};

let volume = parseFloat(localStorage.getItem('volume')) || 50;

let backgrounds = [
	{ url:"img/bg1.avif", logo:"dark", blur:true },
	{ url:"img/bg2.avif", logo:"dark", blur:true },
	//{ url:"img/bg3.avif", logo:"light", credit:"https://steamcommunity.com/sharedfiles/filedetails/?id=3403239559" },
	//{ url:"img/bg4.avif", logo:"dark", blur:true },
	//{ url:"img/bg5.avif", logo:"dark", blur:true },
];

$(document).ready(() => {

	$piano = $('.piano');

	$piano.find('.key').each((i,elem) => {
		let name = $(elem).data('code');
		pianoMap[name] = new PianoKey($(elem), name, null);

		let bind = $(elem).data('bind');
		kbBindings[bind] = elem;
	});

	// NOTE: We cannot load custom binary in local mode, so we still need individual sound files to fallback to.
	if (window.location.href.startsWith('file://')) {

		// Load individual sound files
		for (let key of Object.values(pianoMap))
			key.audio = new Audio(resolveAudioUri(key.name));

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

					if (pianoMap[name]) {
						// Create blob with a local URL (alternatively could use data-url, not sure what is best)
						let blob = new Blob([data], {type:'audio/mp3'});
						let url = URL.createObjectURL(blob);

						// Bind it
						pianoMap[name].audio = new Audio(url);
					}
				}
			}
		};
		req.send(null);

	}

	$piano.on('mousedown', '.key', triggerKey);

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
			volume = Math.min(100, volume+5);
		else if (event.originalEvent.wheelDeltaY < 0)
			volume = Math.max(0, volume-5);
		$('.volume').text(volume);
		localStorage.setItem('volume', volume);
	});
	$('.volume').text(volume);

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

	let keyName = $(this).data('code');
	let sound = pianoMap[keyName].audio.cloneNode();
	sound.volume = volume/100;
	sound.play();

	$(this).addClass('trigger').trigger('hit', [keyName]);

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
//@DONE: [FEATURE] support notes colorization
//@DONE: [FEATURE] mode where the game pauses until the right notes are hit
//@DONE: [IMPROVEMENT] use canvas over piano to render note hints
//@DONE: [FEATURE] new hint style where only the next incoming note/chord is lit up (and maybe the one after semi-lit as well)
//@DONE: [QOL] auto save settings

//@TODO: [QOL] some settings should be specifiable in sheet file (speed, shift)

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
			case 'ArrowLeft': gameState.seek(gameState.ts-2000); return false;
			case 'ArrowRight': gameState.seek(gameState.ts+2000); return false;
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
 * Insert #0 or #1 anywhere to change the current group (ex: left hand/right hand, or just to colorize notes)
 * Example basic file format:
 
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

// Example with groups :
// (optional) set current group 1
#1
0000 26
0400 28
0800 29
// note 26 in group 1, note 29 in group 0, then back to group 1 for the next lines
1200 26 #0 29 #1

*/
function parseSheetText(text) {
	gameSheet = new GameSheet();

	let lines = text.split(/[\r\n]+/);
	let group = 0;
	for (let line of lines) {
		line = line.trim();
		if (!line)
			continue;

		let words = line.split(/\s+/);

		if (words[0].startsWith('//'))
			continue;

		let timestamp;

		for (let i=0; i<words.length; i++) {
			if (words[i].startsWith('#'))
				group = parseInt(words[i].slice(1));
			else if (timestamp === undefined)
				timestamp = parseInt(words[i]);
			else
				gameSheet.push(new Note(timestamp, parseInt(words[i]), group));
		}
	}

	gameSheet.finalize();
	gameState.reset();
}

const CHR_LOWER = '⌄';	//U+2304
const CHR_UPPER = '⌃';	//U+2303

class Note {
	constructor(timestamp, code, group) {
		this.ts = timestamp;
		this.originalCode = code;
		this.group = group || 0;
		this.setCode(code);
	}

	setCode(code) {
		this.code = code + gameSettings.shift;

		if (this.code < 0 || this.code > 36)	// Notes become 0 when shifted away from range - discard them
			this.code = 0;

		//this.column = (code-1) % 12;
		this.column = 3*((this.code-1)%12) + Math.floor((this.code-1)/12);

		this.label = [
			'',
			'W', CHR_UPPER+'W', 'X', CHR_LOWER+'C', 'C', 'V', CHR_UPPER+'V', 'B', CHR_UPPER+'B', 'N', CHR_LOWER+'M', 'M',
			'A', CHR_UPPER+'A', 'S', CHR_LOWER+'D', 'D', 'F', CHR_UPPER+'F', 'G', CHR_UPPER+'G', 'H', CHR_LOWER+'H', 'J',
			'Q', CHR_UPPER+'Q', 'Z', CHR_LOWER+'E', 'E', 'R', CHR_UPPER+'R', 'T', CHR_UPPER+'T', 'Y', CHR_LOWER+'Y', 'U',
		][this.code];

		this.$ = $('.key[data-code="' + pad0(2,this.code) + '"]');
	}

	getColor() {
		return [false,'yellow'][this.group] || 'white';
	}

	toString() {
		return pad0(6,this.ts) + " #" + this.group + " " + pad0(2,this.code);
	}
}

// Array of Note
class GameSheet extends Array {
	constructor() {
		super();
		this.finalize();
	}

	finalize() {
		$('body').toggleClassHelper(this.length > 0, 'gaming', '');
		$('.controls').toggleClassHelper(this.length > 0, 'fa-cog', 'fa-file-audio', true);

		if (this.length == 0) {
			this.lastTs = 999;
			return;
		}

		// Sort notes by timestamp
		this.sort((a,b) => a.ts - b.ts || a.group - b.group || a.code - b.code);

		// Make sure the first note is always at InitialDelay
		if (this[0] && this[0].ts != gameSettings.initialDelay) {
			let shift = gameSettings.initialDelay - this[0].ts;
			for (let item of this)
				item.ts += shift;
		}

		// Save the last timestamp (= track duration)
		this.lastTs = this[this.length-1].ts || 999;

		// Build a reverse lookup map to quickly find notes by timestamp
		// we'll use an array where indices are seconds (timestamp/1000) and value is the next note index
		this.timeTable = [];
		let nextIndex = 0;
		for (let currentSecond=0; currentSecond<=this.lastTs/1000; currentSecond++) {
			while (this[nextIndex].ts/1000 < currentSecond)
				nextIndex++;
			this.timeTable[currentSecond] = nextIndex;
		}
	}

	// startTs, endTs are inclusive
	// Callback arguments: note, index
	// Callback return true to break iteration
	iterateNotesInRange(startTs, endTs, callbackFn) {
		const timeIndex = Math.floor(startTs/1000);
		for (let i=this.timeTable[timeIndex]; i<this.length; i++) {
			if (this[i].ts > endTs)
				break;
			if (this[i].ts >= startTs) {
				if (callbackFn(this[i], i))
					break;
			}
		}
	}

	toString() {
		return this.join("\n");
	}
}

class GameSettings {
	constructor() {
		this.defaults = {

			// Game sheet visible length in milliseconds
			sheetVisibleLength: 3000,

			// Initial delay before first note
			initialDelay: 2000,

			// Playback speed
			speed: 100,

			// Shift all notes by amount
			shift: 0,

			// Upcoming notes indicators
			noteHintStyle: 'ring-ext',
			noteHintDuration: 1000,

			// Play mode (normal, auto-pause, autoplay)
			playMode: '',

		};
		this.load();
	}

	load() {
		this._load('sheetVisibleLength', parseInt);
		this._load('initialDelay', parseInt);
		this._load('speed', parseInt);
		this._load('shift', parseInt);
		this._load('noteHintStyle');
		this._load('noteHintDuration', parseInt);
		this._load('playMode');
	}

	// simplify code for loading
	_load(key, parserFn) {
		let setterName = 'set'+key[0].toUpperCase()+key.slice(1);
		let val = loadFromHash(key, parserFn, this.defaults[key]);
		this[setterName](val);
		
	}

	// factor code for all setters
	// 1. set option to new value
	// 2. update corresponding Html element
	// 3. save to hash
	_set(key, val) {
		this[key] = val;
		$('.gamesettings .'+key).val(this[key]);  //note: will not work with checkboxes
		saveToHash(key, this[key], this.defaults[key]);
	}

	setSheetVisibleLength(val) {
		this._set('sheetVisibleLength', clamp(val, 500, 10000));
		gameState && gameState.renderSheet();
	}

	setInitialDelay(val) {
		this._set('initialDelay', clamp(val, 0, 10000));
		gameSheet && gameSheet.finalize();
		gameState && gameState.reset();
	}

	setSpeed(val) {
		this._set('speed', clamp(val, 10, 800));
	}

	setShift(val) {
		this._set('shift', clamp(val, -24, +24));
		if (gameSheet) {
			for (let note of gameSheet)
				note.setCode(note.originalCode);	// shift applied inside
			gameState.renderSheet();
		}
	}

	setNoteHintStyle(val) {
		this._set('noteHintStyle', val);
		gameState && gameState.renderNoteHints();
	}

	setNoteHintDuration(val) {
		this._set('noteHintDuration', clamp(val, 100, 2000));
		gameState && gameState.renderNoteHints();
	}

	setPlayMode(val) {
		this._set('playMode', val);
	}
}

class GameState {
	constructor() {
		this.$cursor = $('.gametrack .cursor');
		this.$sheet = $('.gamesheet');
		this.sheetCanvas = this.$sheet.find('canvas')[0];
		this.pianoCanvas = $piano.find('canvas')[0];

		$piano.on('hit', '.key', (event,code) => this.onHit(parseInt(code)));
		this.waitingForNotes = [];

		this.reset();
	}

	reset() {
		this.pause();
		this.seek(0);
	}

	play() {
		this.playing = true;
		this.previousBrowserTs = performance.now();
		this.animFrameID = requestAnimationFrame(this.tick.bind(this));
		$('.controls').toggleClassHelper(this.playing, 'fa-pause', 'fa-play', true);

		// clear the autopauser (user can unpause the autopause to skip note)
		this.waitingForNotes = [];
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

	// external seek - called by user (track bar, arrow keybinds)
	seek(newTs) {
		// clear notes hit state (this is for the auto-pause play mode)
		for (let note of gameSheet)
			delete note.hit;
		this.waitingForNotes = [];

		this.internalSeek(newTs);
	}

	// internal seek - called by tick - update this.ts, update visuals
	internalSeek(newTs) {
		this.ts = clamp(newTs, 0, gameSheet.lastTs);
		this.$cursor.css('width', (this.ts/gameSheet.lastTs)*100 + '%');
		this.renderSheet();
		this.renderNoteHints();
	}

	tick(browserTs) {
		let dt = browserTs - this.previousBrowserTs;
		dt *= gameSettings.speed/100;

		if (dt > 0) {
			this.previousTs = this.ts;

			this.internalSeek(this.ts + dt);

			if (gameSettings.playMode == 'auto')
				this.handleModeAuto();
			else if (gameSettings.playMode == 'pause')
				this.handleModePause();
		}

		if (this.ts >= gameSheet.lastTs)
			this.pause();

		if (!this.playing)
			return;

		this.previousBrowserTs = browserTs;
		this.animFrameID = requestAnimationFrame(this.tick.bind(this));
	}

	renderSheet() {
		const canvas = this.sheetCanvas;
		canvas.width = this.$sheet.width();
		canvas.height = this.$sheet.height();

		const ctx = canvas.getContext('2d');
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		
		if (!gameSheet.length)
			return;

		const columnsPosX = this.$sheet.find('.col').map((i, elem) => (elem.offsetLeft-canvas.offsetLeft)+elem.offsetWidth/2);

		ctx.font = 'bold 15px Helvetica';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		const NOTE_SIZE = 28;

		gameSheet.iterateNotesInRange(this.ts, this.ts + gameSettings.sheetVisibleLength, (note) => {
			let posX = columnsPosX[note.column];
			let posY = canvas.height - canvas.height * ((note.ts - this.ts) / gameSettings.sheetVisibleLength);

			ctx.fillStyle = note.getColor();
			ctx.beginPath();
			ctx.arc(posX, posY, NOTE_SIZE/2, NOTE_SIZE/2, 0, 2*Math.PI);
			ctx.fill();

			ctx.fillStyle = 'black';
			ctx.fillText(note.label, posX, posY+1);
		});
	}

	renderNoteHints() {
		const canvas = this.pianoCanvas;
		canvas.width = $piano.width();
		canvas.height = $piano.outerHeight();

		const ctx = canvas.getContext('2d');
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		if (!gameSettings.noteHintStyle || !gameSheet.length)
			return;

		let maxTs = this.ts + gameSettings.noteHintDuration;

		// Hint duration does not apply in this mode, we always illuminate the upcoming chord (and slightly the one after)
		if (gameSettings.noteHintStyle == 'illuminate-next')
			maxTs = gameSheet.lastTs;

		// For illuminate-next
		let nextChordTs, nextNextChordTs;

		gameSheet.iterateNotesInRange(this.ts, maxTs, (note) => {
			const rel = note.$.offsetRelativeTo(canvas);
			const noteRadius = note.$.outerWidth()/2;
			let posX = rel.left + noteRadius;
			let posY = rel.top + noteRadius;

			ctx.strokeStyle = ctx.fillStyle = note.getColor();
			let progress = 1.0 - (note.ts - this.ts)/gameSettings.noteHintDuration;

			switch (gameSettings.noteHintStyle) {
				case 'ring-ext': {
					let radius = lerp(noteRadius+20, noteRadius, progress);
					ctx.globalAlpha = lerp(0, 1, progress*5);
					ctx.beginPath();
					ctx.arc(posX, posY, radius, radius, 0, 2*Math.PI);
					//ctx.lineWidth = 2;
					ctx.stroke();
					break;
				}
				case 'ring-int': {
					let radius = lerp(0, noteRadius, progress);
					ctx.globalAlpha = lerp(0, 1, progress*5);
					ctx.beginPath();
					ctx.arc(posX, posY, radius, radius, 0, 2*Math.PI);
					//ctx.lineWidth = 2;
					ctx.stroke();
					break;
				}
				case 'illuminate-cont': {
					ctx.globalAlpha = lerp(0, 0.65, progress);
					ctx.beginPath();
					ctx.arc(posX, posY, noteRadius, noteRadius, 0, 2*Math.PI);
					ctx.fill();
					break;
				}
				case 'illuminate-next': {
					if (nextChordTs === undefined) {
						nextChordTs = note.ts;
						ctx.globalAlpha = 0.65;
					}
					else if (note.ts > nextChordTs && nextNextChordTs === undefined) {
						nextNextChordTs = note.ts;
						ctx.globalAlpha = 0.2;
					}
					else if (note.ts > nextNextChordTs) {
						return true;  //break from loop
					}

					ctx.beginPath();
					ctx.arc(posX, posY, noteRadius, noteRadius, 0, 2*Math.PI);
					ctx.fill();
					break;  //break from switch
				}
			}
		});
	}

	handleModeAuto() {
		gameSheet.iterateNotesInRange(this.previousTs+0.000001, this.ts, (note) => {
			if (note.code)
				triggerKey.call(note.$[0]);
		});
	}

	handleModePause() {
		let pauseTs;
		gameSheet.iterateNotesInRange(this.previousTs+0.000001, this.ts, (note) => {
			if (note.code && !note.hit) {
				if (pauseTs === undefined)
					pauseTs = note.ts;

				// If notes are very close, or if a deltatime is high, we may get multiple chords in a single frame - only process the first one
				if (note.ts > pauseTs)
					return true;  //break

				// rewind a bit to make sure the missed chord appears
				this.internalSeek(note.ts);
				this.pause();
				this.waitingForNotes.push(note);
			}
		});
	}

	onHit(code) {
		if (this.waitingForNotes.length > 0) {
			for (let i=0; i<this.waitingForNotes.length; i++) {
				if (this.waitingForNotes[i].code == code) {
					this.waitingForNotes.splice(i,1);
					if (this.waitingForNotes.length == 0)
						this.play();
					break;
				}
			}
		}
		else if (this.playing) {
			const TOLERANCE = 300;
			let nextChordTs;
			gameSheet.iterateNotesInRange(this.ts, this.ts+TOLERANCE, (note) => {
				if (nextChordTs === undefined)
					nextChordTs = note.ts;
				if (note.ts == nextChordTs && note.code == code && !note.hit) {
					note.hit = true;
					return true;
				}
			});
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

function getHashParams() {
	let qs = window.location.hash;
	while (qs.startsWith('#'))
		qs = qs.slice(1);
	return new URLSearchParams(qs);
}

function loadFromHash(key, parserFn, fallback) {
	let params = getHashParams();
	return params.has(key) ? (parserFn ? parserFn(params.get(key)) : params.get(key)) : fallback;
}

function saveToHash(key, value, defaultValue) {
	let params = getHashParams();
	if (value === defaultValue) {
		params.delete(key);
		window.location.hash = params.toString();
	}
	else if (String(value) !== params.get(key)) {
		params.set(key, value);
		window.location.hash = params.toString();
	}
}

function pad(chr, count, val) {
	return (chr.repeat(count) + String(val)).slice(-count);
}
function pad0(count, val) { return pad('0', count, val) }

function clamp(val,min,max) {
	return Math.min(Math.max(val,min),max);
}
function lerp(a, b, alpha) {
	return a + alpha*(b-a);
}

$.fn.offsetRelativeTo = function(otherElem) {
	let me = this.offset();
	let other = $(otherElem).offset();
	return { left: me.left - other.left, top: me.top - other.top };
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
