function hideAll() {
  $(".app-panes").removeClass("pane-visible");
}

$(document).on("click", ".list-group-item", function(){
  hideAll();
  var choice = $(this).attr("app-pane");
  $(".list-group-item").removeClass("selected");
  $("#pane-" + choice).addClass("pane-visible");
  $(this).addClass("selected");
});
