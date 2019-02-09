
/*************************************************/
/*************************************************/
/****************   INITIALISE   *****************/
/*************************************************/
/*************************************************/

const hash = window.location.hash
.substring(1)
.split('&')
.reduce(function (initial, item) {
  if (item) {
    var parts = item.split('=');
    initial[parts[0]] = decodeURIComponent(parts[1]);
  }
  return initial;
}, {});

var _token = '';

// Set token
if(hash.access_token === undefined) {
  if(sessionStorage._token !== null) {
    _token = sessionStorage._token;
  }
} else {
  _token = hash.access_token;
  sessionStorage.setItem('_token', _token);
}

history.pushState("", document.title, window.location.pathname + window.location.search);


var device_id = '';
var track_length = '';
var track_progress = '';

// static audio player
var static = document.getElementById("static");
static.volume = 0.3;

var scrubbingAudio = document.getElementById("scrubbing");

// some 90s songs
var retro = [
  ['Toto - Africa', 'spotify:track:2374M0fQpWi3dLnB54qaLX', '#c72c38', '295893'],
  ['Everybody Wants To Rule The World - Tears For Fears', 'spotify:track:40dJCw4xU6Bd5ie9rfagNo', '#555656', '251488'],
  ['Take On Me - a-ha', 'spotify:track:2WfaOiMkCvy7F5fcp2zZ8L', '#575553', '225280'],
  ['Don\'t Stop Believin\' - Journey', 'spotify:track:4bHsxqR3GMrXTxEPLuK5ue', '#585a61', '250986'],
  ['You Make My Dreams - Daryl Hall & John Oates', 'spotify:track:4o6BgsqLIBViaGVbx5rbRk', '#b3b9b8', '190626'],
  ['Come On Eileen - Dexys Midnight Runners', 'spotify:track:5uzNa0SBGOe5pPnstWHMCt', '#7e7363', '273720'],
  ['We Built This City - Starship', 'spotify:track:7aHRctaQ7vjxVTVmY8OhAA', '#d3ceb5', '296080'],
  ['Bette Davis Eyes - Kim Carnes', 'spotify:track:0kPeymTUiaidv48eRrMISu', '#4c4a4d', '228000'],
  ['Don\'t Look Back In Anger - Oasis', 'spotify:track:698mT3CTx8JEnp7twwJrGG', '#878480', '287826'],
  ['Wonderwall - Oasis', 'spotify:track:5wj4E6IsrVtn8IBJQOd0Cl', '#878480', '258906'],
  ['High - Lighthouse Family', 'spotify:track:7zB3ZhA5v33pA4rCdKKGqq', '#686063', '309666'],
  ['Rhythm Is A Dancer - SNAP!', 'spotify:track:1IWzfq3sLedGQ3fb2hAMBA', '#221807', '332229'],
  ['Bohemian Rhapsody - Queen', 'spotify:track:3z8h0TU7ReDPLIbEnYhWZb', '#bc6962', '354947'],
  ['No Limit - 2 Unlimited', 'spotify:track:7pSJmBTlbA4S5zSLsj6Pzz', '#c65b2c', '223694'],
  // ['name', 'uri', '#color'],
];


const authEndpoint = 'https://accounts.spotify.com/authorize';

// Replace with your app's client ID, redirect URI and desired scopes
const clientId = 'a80d3108334f45218137daffd3454993';
const redirectUri = 'https://cassette.test';
const scopes = [
  'user-read-email',
  'user-read-birthdate',
  'user-read-private',
  'streaming',
  'app-remote-control',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'user-read-playback-state',
  // 'user-read-recently-played',
  'user-top-read'
];

// If there is no token, redirect to Spotify authorization
if (!_token) {
  window.location = `${authEndpoint}?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scopes.join('%20')}&response_type=token&show_dialog=true`;
}

// Set up the Web Playback SDK

window.onSpotifyPlayerAPIReady = () => {
  const player = new Spotify.Player({
    name: 'Cassette player',
    getOAuthToken: cb => { cb(_token); }
  });

  // Error handling
  player.on('initialization_error', e => showError(e, e.message));
  player.on('authentication_error', e => showError(e, e.message));
  player.on('account_error', e => showError(e, e.message));
  player.on('playback_error', e => showError(e, e.message));

  // Playback status updates
  player.on('player_state_changed', state => {

    playing = false;
    if(state.paused) {
      $('.cassette .hole, .cassette .tape').removeClass('spinning');
      static.pause();
      if(!scrubbing) {
        $('.buttons a').removeClass('active');
        $('.buttons a[data-action="stop"]').addClass('active');
      }

    } else {
      $('.cassette .hole, .cassette .tape').addClass('spinning').removeClass('spinning-faster spinning-backwards');
      static.play();
      $('.buttons a').removeClass('active');
      $('.buttons a[data-action="play"]').addClass('active');
      setTimeout(function() {
        playing = true;
      }, 300);
    }

    // set cassette details
    $('.js-cassette-title').html(state.track_window.current_track.name + ' - ' + state.track_window.current_track.artists[0].name);

    // convert album art to base 64 so that we can use canvas on this origin to get dominant colour
    getBase64FromImage(state.track_window.current_track.album.images[0].url, function(base64) {
      $('#hidden-artwork').attr('src', base64);

      // get the average colour
      setTimeout(function() {
        var rgb = getAverageRGB(document.getElementById('hidden-artwork'));
        $('.js-band-color').css('backgroundColor', 'rgb('+rgb.r+','+rgb.g+','+rgb.b+')');
      }, 100);


    });

  });

  // Ready
  player.on('ready', data => {
    device_id = data.device_id;

    // play a random track
    var randomRetro = retro[Math.floor(Math.random() * retro.length)];
    play_track(randomRetro[1]);
    $('.controls').addClass('show');
    $('.input-container').addClass('show');
    // $('.js-cassette-title').html(randomRetro[0]);
    // $('.first-play').attr('data-uri', randomRetro[1]);
    // $('.js-band-color').css('backgroundColor', randomRetro[2]);
    // track_progress = 0;
    // track_length = randomRetro[3];

  });

  // Connect to the player!
  player.connect();

}



// Search for a track - get results
function search(query) {
  $.ajax({
    url: "https://api.spotify.com/v1/search?type=track,artist&q=" + query,
    type: "GET",
    beforeSend: function(xhr){xhr.setRequestHeader('Authorization', 'Bearer ' + _token );},
    success: function(data) {
      $('.js-search-results').html('');

      if(data.tracks.items.length < 1) {
        $('.js-no-results').show();
      } else {
        $('.js-no-results').hide();
      }

      $.each(data.tracks.items, function(key, track) {

        $('.js-search-results').append('' +
        '<li>' +
          '<a href="#" data-id="' + track.uri + '">' +
            '<div class="album-art">' +
              '<img src="' + track.album.images[0].url + '" alt="">' +
            '</div>' +
            '<div class="track-details">' +
              '<div>' +
                '<span class="title">' + track.name + '</span>' +
                '<span class="artist">' + track.artists[0].name + '</span>' +
              '</div>' +
            '</div>' +
          '</a>' +
        '</li>' +
        '');
      });
    }
  });
}


// Play a track
function play_track(uri) {

  $.ajax({
   url: "https://api.spotify.com/v1/me/player/play?device_id=" + device_id,
   type: "PUT",
   data: '{"uris": ["' + uri + '"]}',
   beforeSend: function(xhr){xhr.setRequestHeader('Authorization', 'Bearer ' + _token );},
   success: function(data) {
     playing = true;
   },
   error: function(data) {
     showError(data.responseJSON.error.message);
   }
  });

}


// Get this users recently played tracks
function getRecentlyPlayed() {
  $.ajax({
    url: "https://api.spotify.com/v1/me/top/tracks?limit=15",
    type: "GET",
     beforeSend: function(xhr){xhr.setRequestHeader('Authorization', 'Bearer ' + _token );},
     success: function(data) {
       $('.js-recently-played').html();
       $.each(data.items, function(key, track) {
         $('.js-recently-played').append('' +
         '<li>' +
           '<a href="#" data-id="' + track.uri + '">' +
             '<div class="album-art">' +
               '<img src="' + track.album.images[0].url + '" alt="">' +
             '</div>' +
             '<div class="track-details">' +
               '<div>' +
                 '<span class="title">' + track.name + '</span>' +
                 '<span class="artist">' + track.artists[0].name + '</span>' +
               '</div>' +
             '</div>' +
           '</a>' +
         '</li>' +
         '');
       });
     }
  });
}





var fastForward;
var rewind;
var scrubbing = false;
var playing = false;


function play() {
  playing = true;
  $('.cassette .hole, .cassette .tape').removeClass('spinning-faster spinning-backwards');
  if(scrubbing) {
    setTrackTime('play');
  } else {
    $.ajax({
     url: "https://api.spotify.com/v1/me/player/play",
     type: "PUT",
     beforeSend: function(xhr){xhr.setRequestHeader('Authorization', 'Bearer ' + _token );},
     success: function(data) {
     }
    });
  }

}

function pause() {
  playing = false;
  $('.cassette .hole, .cassette .tape').removeClass('spinning spinning-faster spinning-backwards');
  if(scrubbing) {
    setTrackTime('stop');
  } else {
    $.ajax({
     url: "https://api.spotify.com/v1/me/player/pause",
     type: "PUT",
     beforeSend: function(xhr){xhr.setRequestHeader('Authorization', 'Bearer ' + _token );},
     success: function(data) {
     }
    });
  }
}

function forward() {
  pause();
  scrubbingAudio.play();
  scrubbing = true;
  $('.cassette .hole, .cassette .tape').addClass('spinning-faster');
  $.ajax({
   url: "https://api.spotify.com/v1/me/player/pause",
   type: "PUT",
   beforeSend: function(xhr){xhr.setRequestHeader('Authorization', 'Bearer ' + _token );},
   success: function(data) {
     fastForward = setInterval(function(){
       track_progress = parseInt(track_progress) + 750;
       tapes(track_length, track_progress);
       if(track_progress > track_length) {
         track_progress = track_length;
         setTrackTime('stop');
       }
     }, 100);
   }
  });

}

function backward() {
  pause();
  scrubbingAudio.play();
  scrubbing = true;
  $('.cassette .hole, .cassette .tape').addClass('spinning-backwards');
  $.ajax({
   url: "https://api.spotify.com/v1/me/player/pause",
   type: "PUT",
   beforeSend: function(xhr){xhr.setRequestHeader('Authorization', 'Bearer ' + _token );},
   success: function(data) {
     fastForward = setInterval(function(){
       track_progress = parseInt(track_progress) - 750;
       tapes(track_length, track_progress);
       if(track_progress < 0) {
         track_progress = 0;
         setTrackTime('stop');
       }
     }, 100);
   }
  });

}


// Select a track to play
function selectTrack(track) {
  $('input[name="search"]').blur();
  play_track(track.attr('data-id'));
}


function setTrackTime(action) {
  clearInterval(fastForward);
  clearInterval(rewind);
  scrubbingAudio.pause();
  $.ajax({
   url: "https://api.spotify.com/v1/me/player/seek?position_ms=" + track_progress,
   type: "PUT",
   beforeSend: function(xhr){xhr.setRequestHeader('Authorization', 'Bearer ' + _token );},
   success: function(data) {
     setTimeout(function() {
       scrubbing = false;
       if(action == 'play') {
         setTimeout(function() {
           $.ajax({
            url: "https://api.spotify.com/v1/me/player/play",
            type: "PUT",
            beforeSend: function(xhr){xhr.setRequestHeader('Authorization', 'Bearer ' + _token );},
            success: function(data) {
            }
           });
         }, 200);
       }
       if(action == 'stop') {
         $('.cassette .hole, .cassette .tape').removeClass('spinning spinning-faster spinning-backwards');
         $('.buttons a').removeClass('active');
         $('.buttons a[data-action="stop"]').addClass('active');
         $.ajax({
          url: "https://api.spotify.com/v1/me/player/pause",
          type: "PUT",
          beforeSend: function(xhr){xhr.setRequestHeader('Authorization', 'Bearer ' + _token );},
          success: function(data) {
          }
         });
       }
     }, 100);
   }
  });

}



function tapes(track_length, track_progress) {
  var percent = (100 / track_length) * track_progress;

  // work out progress as percent of scale 0.3 (min) - 1 (max)
  var percent = ((70 / 100) * percent) + 30;

  $('.cassette .tape.right').css({
    '-webkit-transform' : 'scale(' + (percent / 100) + ')',
    '-moz-transform' : 'scale(' + (percent / 100) + ')',
    '-ms-transform' : 'scale(' + (percent / 100) + ')',
    '-o-transform' : 'scale(' + (percent / 100) + ')',
    'transform' : 'scale(' + (percent / 100) + ')'
  });
  $('.cassette .tape.left').css({
    '-webkit-transform' : 'scale(' + ((130 - percent) / 100) + ')',
    '-moz-transform' : 'scale(' + ((130 - percent) / 100) + ')',
    '-ms-transform' : 'scale(' + ((130 - percent) / 100) + ')',
    '-o-transform' : 'scale(' + ((130 - percent) / 100) + ')',
    'transform' : 'scale(' + ((130 - percent) / 100) + ')'
  });
}





// Error handling
function showError(error, e) {
  // console.log(error);
  $('.custom-error').addClass('show');
  sessionStorage.removeItem('_token');
  $('.broken-tape').addClass('show');
  $('.controls').removeClass('show');
  $('.input-container').removeClass('show');
  $('.cassette .hole, .cassette .tape').removeClass('spinning');
  $('.js-cassette-title').html(e + ' - <a href="/">Try again</a>');
  $('.js-band-color').css('background-color', '#8c0000');
}







$(function() {


  // get search input and send to spotify

  $('input[name="search"]').keyup(function (e) {


      // live searching
      var q = $(this).val();
      var nav = 'js-recently-played';
      if(q == '') {
        $('.recently-played').addClass('on');
        $('.js-search-results').removeClass('on');
        nav = 'js-recently-played';
      } else {
        $('.recently-played').removeClass('on');
        $('.js-search-results').addClass('on');
        nav = 'js-search-results';

        if(e.keyCode != 40 && e.keyCode != 38) {
          //don't search again if it's up or down that is pressed
          search(q);
        }
      }



    // Allow user to navigate song results with their keyboard
    if (e.keyCode == 40) { // down
      var selected = $("." + nav + " .selected");
      if (selected.length == 0) {
        $("." + nav + "").children().first().addClass('selected');
      } else {
        $("." + nav + " li").removeClass("selected");
        if (selected.next().length == 0) {
            selected.siblings().first().addClass("selected");
        } else {
            selected.next().addClass("selected");
        }
      }
      $('.search-results').scrollTop(0);
      $('.search-results').scrollTop($('.' + nav + ' .selected').offset().top - $('.search-results').offset().top - 30);
    }

    if (e.keyCode == 38) { // up
      var selected = $("." + nav + " .selected");
      $(".services li").removeClass("selected");
      if (selected.length == 0) {
        $("." + nav + "").children().last().addClass('selected');
      } else {
        $("." + nav + " li").removeClass("selected");
        if (selected.prev().length == 0) {
            selected.siblings().last().addClass("selected");
        } else {
            selected.prev().addClass("selected");
        }
      }
      $('.search-results').scrollTop(0);
      $('.search-results').scrollTop($('.' + nav + ' .selected').offset().top - $('.search-results').offset().top - 30);
    }

    if (e.keyCode == 13) { // enter
      selectTrack($('.' + nav + ' .selected a'));
    }

    if (e.keyCode == 27) { // escape
      $('input[name="search"]').blur();
    }

  });



  $(document).on('mousedown', '.search-results li a', function(e) {
    e.preventDefault();
    selectTrack($(this));
  });




  // focus the search results
  $('input').focus(function() {
    $('.search-results').show();
    $('.input-container').addClass('results');
  });

  $('input').focusout(function() {
    $('.search-results').hide();
    $('.input-container').removeClass('results');
  });


  // Get this user's recently played tracks
  getRecentlyPlayed();



  // every second, check the status of play so that we can update cassette animations
  setInterval(function() {

      if(playing) {
        $.ajax({
         url: "https://api.spotify.com/v1/me/player",
         type: "GET",
         beforeSend: function(xhr){xhr.setRequestHeader('Authorization', 'Bearer ' + _token );},
         success: function(data) {


           if(typeof data !== "undefined") {

             track_length = data.item.duration_ms;
             if(track_progress <= data.progress_ms) {
               track_progress = data.progress_ms;
             }

             tapes(track_length, track_progress);

           }

         }
        });
      }


  }, 1000);







  // buttons

  $('.buttons a').click(function(e) {
    e.preventDefault();

    if($(this).hasClass('first-play')) {
      $(this).removeClass('first-play');
      play_track($(this).attr('data-uri'));

    } else {

      if(!$(this).hasClass('active')) {

        var action = $(this).attr('data-action');

        if(action == 'play') {
          play();
        }
        if(action == 'stop') {
          pause();
        }

        if(!scrubbing) {
          if(action == 'forward') {
            $('.buttons a').removeClass('active');
            $(this).addClass('active');
            forward();
          }
          if(action == 'backward') {
            $('.buttons a').removeClass('active');
            $(this).addClass('active');
            backward();
          }
        }

      }

    }

  });




});

















/*************************************************/
/*************************************************/
/******************  FUNCTIONS  ******************/
/*************************************************/
/*************************************************/


// get average colour script
function getAverageRGB(imgEl) {

    var blockSize = 5, // only visit every 5 pixels
        defaultRGB = {r:0,g:0,b:0}, // for non-supporting envs
        canvas = document.createElement('canvas'),
        context = canvas.getContext && canvas.getContext('2d'),
        data, width, height,
        i = -4,
        length,
        rgb = {r:0,g:0,b:0},
        count = 0;

    if (!context) {
        return defaultRGB;
    }

    height = canvas.height = imgEl.naturalHeight || imgEl.offsetHeight || imgEl.height;
    width = canvas.width = imgEl.naturalWidth || imgEl.offsetWidth || imgEl.width;

    context.drawImage(imgEl, 0, 0);

    try {
        data = context.getImageData(0, 0, width, height);
    } catch(e) {
        /* security error, img on diff domain */alert('x');
        return defaultRGB;
    }

    length = data.data.length;

    while ( (i += blockSize * 4) < length ) {
        ++count;
        rgb.r += data.data[i];
        rgb.g += data.data[i+1];
        rgb.b += data.data[i+2];
    }

    // ~~ used to floor values
    rgb.r = ~~(rgb.r/count);
    rgb.g = ~~(rgb.g/count);
    rgb.b = ~~(rgb.b/count);

    return rgb;

}








function getBase64FromImage(url, onSuccess, onError) {
    var xhr = new XMLHttpRequest();

    xhr.responseType = "arraybuffer";
    xhr.open("GET", url);

    xhr.onload = function () {
        var base64, binary, bytes, mediaType;

        bytes = new Uint8Array(xhr.response);
        //NOTE String.fromCharCode.apply(String, ...
        //may cause "Maximum call stack size exceeded"
        binary = [].map.call(bytes, function (byte) {
            return String.fromCharCode(byte);
        }).join('');
        mediaType = xhr.getResponseHeader('content-type');
        base64 = [
            'data:',
            mediaType ? mediaType + ';':'',
            'base64,',
            btoa(binary)
        ].join('');
        onSuccess(base64);
    };
    xhr.onerror = onError;
    xhr.send();
}
