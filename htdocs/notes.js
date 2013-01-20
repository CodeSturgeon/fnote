// http://stackoverflow.com/questions/901115/how-can-i-get-query-string-values
function getParameterByName(name) {
  var match = RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
  return match && decodeURIComponent(match[1].replace(/\+/g, ' '));
}

function txt2Html(str){
  return marked(str);
}

function makeNote(cfg){
  /*jshint es5:true */
  cfg = cfg || {};
  cfg.content = cfg.content || 'Your content here';
  var ddiv = $('<div/>', {
    class: 'note',
    'id':cfg._id
  });
  ddiv.append(
    $('<div/>', {class:'note-content'}).html(txt2Html(cfg.content))
  );
  ddiv.data().cfg = cfg;
  return ddiv;
}

var loadIncrement = 60;
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
}

function go() {
  marked.setOptions({breaks: true});
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
          alert('did not find sheet - creating');
          saveSheet();
        }
      });
    },
    error: function(error) {console.log(error);}
  });
  $(window).unload(function windowUnload(){
    $.ajaxSetup({async:false});
    saveSheet();
  });
  $('#removeBtn').click(function populateMenu(){
    var menu = $('.dropdown-menu');
    menu.children().remove();
    $('.note').each(function (index, element){
      var note = $(element);
      var cfg = note.data().cfg;
      var mark = cfg.content.indexOf('\n');
      if (mark === -1 || mark > 30) {mark = 25;}
      var snip = cfg.content.substr(0,mark);
      var item = $('<li/>').append(
        $('<a/>',{
          tabindex:'-1',
          href:'#',
          text:snip
        }).click(function killNote(){
          note.remove();
          saveSheet();
        })
      );
      menu.append(item);
    });
  });
  $('#newBtn').click(function newClick(){
    var note = makeNote();
    addNote(note);
    bindNotes(note);
    db.saveDoc(note.data().cfg, {
      success: function firstNoteSave(data) {
        note.data().cfg._id = data.id;
        console.log(note.data().cfg);
      }
    });
    saveSheet();
  });
}

function loadNote(nLink) {
  db.openDoc(nLink.id, {
    success: function(data) {
      var note = makeNote(data);
      addNote(note, nLink);
      bindNotes(note);
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
      alert('Sheet save failed :/');
      console.log(status);
    }
  });
}

function bindNotes(notes) {
  function editNote(event) {
    /*jshint es5:true */
    var note = $(event.target).parents('.note');
    var content = note.children('.note-content');
    note.children().hide();

    var ta = $('<textarea/>',{class:'editor'})
      .width(note.width()-6)
      .height(note.height()-6)
      .text(note.data().cfg.content)
      .blur(function cleanupEditor(event){
        var txt = ta.val();
        note.data().cfg.content = txt;
        db.saveDoc(note.data().cfg);
        content.html(txt2Html(txt));
        ta.remove();
        note.children().show();
      });

    note.append(ta);
    ta.focus();
  }

  notes
    .draggable({
      stack:'.note',
      stop: saveSheet
    })
    .resizable({
      stop:saveSheet
    })
    .dblclick(editNote);
}
