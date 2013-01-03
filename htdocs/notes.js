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
  cfg.heading = cfg.heading || 'New Header';
  cfg.content = cfg.content || 'Your content here';
  var html = txt2Html(cfg.content);
  var ddiv = $('<div/>', {class: 'note'});
  ddiv.append(
    $('<div/>', {class:'note-heading'}).text(cfg.heading),
    $('<div/>', {class:'note-content'}).html(html),
    $('<div/>', {class:'note-draghandle'})
  );
  ddiv.data().cfg = cfg;
  return ddiv;
}

var loadIncrement = 20;
function addNote(note, cfg) {
  //loadIncrement = loadIncrement || 20;
  cfg = cfg || {};
  cfg.top = cfg.top || loadIncrement+'px';
  cfg.left = cfg.left || loadIncrement+'px';
  if (cfg.top === loadIncrement+'px' && cfg.left == loadIncrement+'px') {
    loadIncrement = loadIncrement + 25;
  }
  cfg.height = cfg.height || '';
  cfg.width = cfg.width || '';
  note.css('top', cfg.top);
  note.css('left', cfg.left);
  note.css('width', cfg.width);
  note.css('height', cfg.height);
  $('.container').append(note);
}

function notesMap(doc) {
  if (doc.type==='note') {
    emit(doc._id, doc);
  }
}

function go() {
  $.couch.urlPrefix = 'http://localhost:1337';
  sheetName = getParameterByName('sheet') || 'test-sheet';
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
    bindNotes(note);
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
    _id: "test-sheet",
    _rev: rev,
    notes: []
  };
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

function bindNotes(notes) {
  // Moving and resizing
  var x = 0, y = 0; // Dragging and resizing vars
  var target = '';

  var mover = function(event) {
    var deltaX = event.pageX - x,
        deltaY = event.pageY - y;

    x = event.pageX;
    y = event.pageY;

    target.offset({
        left: target.offset().left + deltaX,
        top: target.offset().top + deltaY
    });
  };

  var resizer = function(event) {
    var deltaX = event.pageX - x,
        deltaY = event.pageY - y;

    x = event.pageX;
    y = event.pageY;

    target.width(target.width()+deltaX);
    target.height(target.height()+deltaY);
  };

  var unbinder = function(event) {
    $(document)
      .unbind('mousemove', mover)
      .unbind('mousemove', resizer)
      .unbind('mouseup', unbinder);
  };

  notes.children('.note-heading')
    .mousedown(function noteDrag(event) {
      x = event.pageX;
      y = event.pageY;
      target = $(this).parent();
      $(document).bind('mousemove', mover);
      $(document).bind('mouseup', unbinder);
    })
    .dblclick(function headerEdit(event) {
      console.log('d');
      var heading = $(this);
      var note = heading.parent();
      console.log(note);
      heading.text('');
      var input = $('<input/>',{type:'text', 'class':'editor'});
      input.val(note.data().cfg.heading);
      input.blur(function(){
        var txt = input.val();
        note.data().cfg.heading = txt;
        heading.text(txt);
        input.remove();
        db.saveDoc(note.data().cfg);
      });
      note.prepend(input);
      input.focus();
    });

  notes.children('.note-draghandle').mousedown(function noteResize(event) {
    x = event.pageX;
    y = event.pageY;
    target = $(this).parent();
    $(document).bind('mousemove', resizer);
    $(document).bind('mouseup', unbinder);
  });

  // Editing
  notes.children('.note-content').dblclick(function editNote(event) {
    /*jshint es5:true */
    var note = $(event.target).parent();
    var content = note.children('.note-content');
    var heading = note.children('.note-heading');
    content.hide();
    var ta = $('<textarea/>',{class:'editor'})
      .width(note.width()-6)
      .height(note.height()-(heading.height()+6))
      .text(note.data().cfg.content)
      .blur(function cleanupEditor(event){
        var txt = ta.val();
        var html = txt2Html(txt);
        note.data().cfg.content = txt;
        db.saveDoc(note.data().cfg);
        content.html(html);
        content.show();
        ta.remove();
      });
    note.append(ta);
    ta.focus();
  });

}
