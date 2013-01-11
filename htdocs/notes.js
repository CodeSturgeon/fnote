// http://stackoverflow.com/questions/901115/how-can-i-get-query-string-values
function getParameterByName(name) {
  var match = RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
  return match && decodeURIComponent(match[1].replace(/\+/g, ' '));
}

function txt2Html(str){
  var html = str.replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1<br/>$2');
  html = html.replace(/ /g, '&nbsp');
  return html;
}

function makeNote(cfg){
  /*jshint es5:true */
  cfg = cfg || {};
  cfg.heading = cfg.heading || ' ';
  cfg.content = cfg.content || 'Your content here';
  var html = txt2Html(cfg.content);
  var ddiv = $('<div/>', {'id':cfg._id, class: 'note note-content'});
  ddiv.html(html);
  ddiv.prepend(
    $('<div/>', {class:'note-heading'}).html(txt2Html(cfg.heading))
  );
  ddiv.data().cfg = cfg;
  return ddiv;
}

var loadIncrement = 20;
function addNote(note, cfg) {
  cfg = cfg || {};
  cfg.top = cfg.top || loadIncrement+'px';
  cfg.left = cfg.left || loadIncrement+'px';
  if (cfg.top === loadIncrement+'px' && cfg.left == loadIncrement+'px') {
    loadIncrement = loadIncrement + 25;
  }
  cfg.height = cfg.height || '100px';
  cfg.width = cfg.width || '150px';
  note.css('top', cfg.top);
  note.css('left', cfg.left);
  note.css('width', cfg.width);
  note.css('height', cfg.height);
  $('.container').append(note);
  note.draggable().resizable();
}

function notesMap(doc) {
  if (doc.type==='note') {
    emit(doc._id, doc);
  }
}

function go() {
  $.couch.urlPrefix = 'http://localhost:1337';
  sheetName = getParameterByName('sheet') || 'test-sheet';
  rev = '';
  db = $.couch.db('notes');
  $.couch.login({
    name: 'test',
    password: 'test',
    success: function(data) {
      db.openDoc(sheetName, {
        success: function(sheetDoc) { loadSheet(sheetDoc); },
        error: function(error) {
          // FIXME should make the sheet here
          console.log(error);
          alert('could not find sheet');
        }
      });
    },
    error: function(error) {console.log(error);}
  });
  $(window).unload(function windowUnload(){
    $.ajaxSetup({async:false});
    saveSheet();
  });
  $('#newBtn').click(function newClick(){
    var note = makeNote();
    addNote(note);
    db.saveDoc(note.data().cfg, {
      success: function firstNoteSave(data) {
        note.data().cfg._id = data.id;
        console.log(note.data().cfg);
      }
    });
  });
}

function loadNote(nLink) {
  db.openDoc(nLink.id, {
    success: function(data) {
      var note = makeNote(data);
      addNote(note, nLink);
      //bindNotes(note);
    },
    error: function(status) {
      console.log(status);
    }
  });
}

function loadSheet(sheetData) {
  // Assuming that data is a sheet doc
  rev = sheetData._rev;
  for (var nIdx in sheetData.notes) {
    var nLink = sheetData.notes[nIdx];
    loadNote(nLink);
  }
}

function saveSheet() {
  var sheetDoc = {
    _id: sheetName,
    notes: []
  };
  if (rev !== '') sheetDoc._rev = rev;
  $('.note').each(function(i, noteDiv){
    var jNote = $(noteDiv);
    var noteCfg = jNote.data().cfg;
    var noteNode = {
      id: noteCfg._id,
      left: jNote.css('left'),
      top: jNote.css('top'),
      width: jNote.css('width'),
      height: jNote.css('height')
    };
    sheetDoc.notes.push(noteNode);
  });
  db.saveDoc(sheetDoc, {
    success: function(data) {
      rev = data.rev;
    },
    error: function(status) {
      console.log(status);
    }
  });
}
