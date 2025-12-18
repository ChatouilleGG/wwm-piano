
//@TODO: find a way to merge all sounds into a single-file sound bank and use that instead.
//@TODO: option to disable background

let kbBindings = {};
let modifier = "regul";	// regul | lower | upper

let audioMap = {};

let volume = 0.5;

let backgrounds = [
	{ url:"img/bg1.avif", logo:"dark", blur:true },
	{ url:"img/bg2.avif", logo:"dark", blur:true },
	{ url:"img/bg3.avif", logo:"light", credit:"https://steamcommunity.com/sharedfiles/filedetails/?id=3403239559" },
];

$(document).ready(() => {
	$('.piano').on('mousedown', '.key', triggerKey);

	$('.key').each((i,elem) => {
		let bind = $(elem).data('bind');
		kbBindings[bind] = elem;

		let audioKey = $(elem).data('audio');
		audioMap[audioKey] = new Audio(resolveAudioUri(audioKey));
	});

	$('body').on('keydown keyup', (event) => {
		if (event.shiftKey)
			modifier = "upper";
		else if (event.ctrlKey)
			modifier = "lower";
		else
			modifier = "regul";

		updateShowBinds(modifier);
	});
	updateShowBinds(modifier);

	$('body').on('keydown', (event) => {
		if (!event.originalEvent.repeat) {
			let bind = modifier+"-"+event.originalEvent.code;
			if (kbBindings[bind])
				triggerKey.call(kbBindings[bind]);
		}
		// prevent stuff like ctrl+A, ctrl+R
		if (kbBindings["regul-"+event.originalEvent.code])
			return false;
	});

	$('body').on('mousewheel', (event) => {
		if (event.originalEvent.wheelDeltaY > 0)
			volume = Math.min(1, volume+0.05);
		else if (event.originalEvent.wheelDeltaY < 0)
			volume = Math.max(0, volume-0.05);
		$('.volume').text(Math.round(volume*100));
	});

	{
		let bg = backgrounds[Math.floor(backgrounds.length*Math.random())];
		$('.background').css('background-image', 'url('+bg.url+')');
		$('.wwm-logo').attr('src', 'img/wwm-'+bg.logo+'.webp');
		if (bg.blur)
			$('.key').css('backdrop-filter', 'blur(2px)');
		if (bg.credit)
			$('.bg-credit').html('<a href="'+bg.credit+'" target="_blank"><i class="fa fa-link mr-1"></i>background</a>');
	}

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
