/*
 * Copyright (C) 2009 Cognifide
 *
 * This file is part of Taskboard.
 *
 * Taskboard is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Taskboard is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.

 * You should have received a copy of the GNU General Public License
 * along with Taskboard. If not, see <http://www.gnu.org/licenses/>.
 */

(function($) { // just to make sure $ is a jQuery

/*
 * A Taskboard object containing some global methods.
 */
var TASKBOARD = {};
window.TASKBOARD = TASKBOARD;

/*
 * Some taskboard utils
 * =========================================================
 */
TASKBOARD.utils = {
    /*
     * Expand columns to the height of the highest column.
     * Use 50 pixel offset for easier dragging and dropping
     * and min-height property to keep them expandable.
     */
    expandColumnsHeight : function(){
        $("#taskboard .lane:first .row").each(function(){
            $("#taskboard .row_" + $(this).data("data").id).equalHeight({ offset: 30, css : "min-height" });
        });
        $("#taskboard .column h2").equalHeight({ css : "min-height" });
    },

    /*
     * Expand taskboard width so all columns can fit into it,
     * but don't make the body narrower than window.
     */
    //FIXME body width with meta column
    expandTaskboardWidth : function(){
        var columnsWidth = $("#taskboard .lane").sumWidth() + 10;
        $("body").width(columnsWidth);
        if ($(window).width() > columnsWidth){
            $("body").width($(window).width());
        }
        $("#taskboard").width(columnsWidth);
    },

    /*
     * Expand taskboard width and height.
     * @see expandColumnsHeight
     * @see expandTaskboardWidth
     */
    expandTaskboard : function(){
        this.expandColumnsHeight();
        this.expandTaskboardWidth();
    }
};

/*
 * Methods used to build taskboard elements from data
 * =========================================================
 */
TASKBOARD.builder = {};

/*
 * Various taskboard options
 * ================================================
 */
TASKBOARD.builder.options = {
    // TODO: edit-mode-only
    /* Options for sorting cards */
    cardSort : {
        connectWith: ["#taskboard ol.cards"],
        cursor: "move",
        opacity: 0.40,
        placeholder: "placeholder",
        distance : 30,
        revert: 50,
        tolerance: 'pointer',
        start: function(ev, ui){
            ui.placeholder.html($(ui.item).html());
            if($(ui.item).hasClass("collapsed")){
                 ui.placeholder.addClass("collapsed");
            }
            //TODO: get padding from CSS?
            ui.helper.width($(ui.item).parent().width() - 25);
            // fixing IE7 drag overlapping bug
            if($.browser.msie){
                ui.item.closest(".column").css("zIndex", "4");
            }
        },
        //.TODO: just a workaround for opacity
        sort : function(ev, ui){
            ui.item.css({opacity : 0.4});
            // unselect any text selected during drag
            if (document.selection) {
                document.selection.empty();
            } else {
                window.getSelection().removeAllRanges();
            }
        },
        change : function(ev, ui){
            TASKBOARD.utils.expandTaskboard();
        },
        stop : function(ev, ui){
            if($.browser.msie){
                $("#taskboard .column").css("zIndex", "");
            }
            TASKBOARD.utils.expandColumnsHeight();
            ui.item.width("auto");
            // get current position of card counting from 1
            // there is no placeholder already
            var position = ui.item.parent().children().index(ui.item) + 1;
            var column_id = ui.item.parent().parent().data('data').id;
            var row_id = ui.item.parent().data('data').id;
            // TODO: check if card column and position changed
            //   if(position != ui.item.data('position')){
                TASKBOARD.remote.api.moveCard(ui.item.data("data").id, column_id, row_id, position);
            //   }
        },
        zIndex : 5
    },

    // TODO: edit-mode-only
    /* Options for sorting columns */
    columnSort : {
        connectWith: ["#taskboard"],
        items: ".column",
        cursor: "move",
        placeholder: "lane column placeholder",
        revert: 50,
        start: function(ev, ui){
            var position = $("#taskboard .column").index(ui.item);
            ui.item.data('position', position);
            ui.placeholder.height($(ui.item).height());
            ui.placeholder.width($(ui.item).width());
        },
        sort : function(ev, ui){
            ui.item.css({opacity : 0.4});
        },
        stop: function(ev, ui){
            var position = $("#taskboard .column").index(ui.item);
            if(position !== ui.item.data('position')){
                // server counts positions starting from 1
                TASKBOARD.remote.api.moveColumn(ui.item.data("data").id, position + 1);
                TASKBOARD.form.updateColumnSelect();
            }
        },
        axis: "x",
        opacity: 0.40,
        zIndex : 5,
        appendTo : 'body',
        handle : $.browser.msie ? "h2" : false
    },

    /* Options for resizing columns */
    columnResize : {
        minWidth : 100,
        maxWidth: 500,
        handles: "e",
        transparent: false,
        resize : function(ev, ui){
            TASKBOARD.utils.expandTaskboard();
            ui.element.height("auto");
        },
        stop : function(ev, ui){
            TASKBOARD.cookie.setColumnWidth(ui.helper.data("data").id, ui.size.width);
            TASKBOARD.utils.expandTaskboard();
            ui.element.height("auto");
        }
    }
};

/* String constants */
// TODO: get rid of this
TASKBOARD.builder.strings = {
    columnHeaderTitle : "Double-click to edit",

    tagsTooltip: "You can use '<strong>,</strong>' to add multiple tags<br/>e.g.: <strong>exempli, gratia</strong>",

    notesTooltip: "<p>You can use Markdown syntax:</p>" +
                  "<p># This is an H1<br/> ### This is an H3, etc...</p>"+
                  "<p>**<strong>bold text</strong>** <em>_italic text_</em></p>"+
                  "<p>* first list item<br/>* second list item</p>" +
                  "<p>1. first ordered list item<br/>2. second ordered list item</p>" +
                  "<p>Remember to put empty line to start new paragraph.</p>"+
                  "Learn more from <a rel='external' href='http://daringfireball.net/projects/markdown/basics'>official Markdown syntax guide</a>."
};

TASKBOARD.builder.actions = {
    changeColorAction : function(){
        return $.tag("a", "Change the color", { className : "changeColor", title : "Change the color", href : "#" });
    },

    deleteCardAction : function(){
        return $.tag("a", "Delete card", { className : "deleteCard", title : "Delete card", href : "#" });
    },

    deleteColumn : function(){
        return $.tag("a", "Delete column", { className : 'deleteColumn', title : 'Delete column', href : '#' });
    },

    cleanColumn : function(){
        return $.tag("a", "Delete all cards from column", { className : 'cleanColumn', title : 'Delete all cards from column', href : '#' });
    },

    deleteRow : function(){
        return $.tag("a", "Delete row", { className : 'deleteRow', title : 'Delete row', href : '#' });
    },

    cleanRow : function(){
        return $.tag("a", "Delete all cards from column", { className : 'cleanRow', title : 'Delete all cards from row', href : '#' });
    },

    copyCardAction : function(){
        return $.tag("a", "+", { className : "copyCard", title : "Copy card", href : "#" });
    },

    rowActions : function(row){
        var infoRow = $.tag('span', "(" + row.position + ":" + row.id + ")", { className : "RowInfo" });
        return $.tag("a", infoRow, { className : 'rowActions', title : "position:row_id", href : '#' });
    },

    foldRow : function(row_id, fold){
        if( fold )
            return $.tag("a", "", { id : 'fold_' + row_id, className : 'foldRowExpand', title : 'Expand row', href : '#' });
        else
            return $.tag("a", "", { id : 'fold_' + row_id, className : 'foldRowCollapse', title : 'Collapse row', href : '#' });
    },

    addCCPMInfoAction : function(){
        return $.tag("a", "Add CCPM Info", { className : "addCCPMInfo", title : "Add CCPM Info", href : "#" });
    },
};

/*
 * Builds a column element from JSON data.
 */
TASKBOARD.builder.buildColumnFromJSON = function(column){
    var colHours = (column.sumHours > 0)
        ? $.tag("span", "(S" + column.sumHours + ")", { className: "ColSum", title: "hours of column" })
        : '';
    var headerClass = (column.coltype == 1) ? "Burndown" : "Normal";
    var header = $.tag("h2", column.name.escapeHTML() + colHours, { className: headerClass });
    var columnLi = "";
    // edit-mode-only
    if(TASKBOARD.editor){
        var actionsColumn = $.tag("li", TASKBOARD.builder.actions.deleteColumn());
        actionsColumn += $.tag("li", TASKBOARD.builder.actions.cleanColumn());
        columnLi = $.tag("ul", actionsColumn, { className : 'actions' });
    }

    columnLi += header;
    columnLi = $.tag("li", columnLi, { id : 'column_' + column.id, className :'lane column' });
    columnLi = $(columnLi)
                .data('data', column)
                .resizable(TASKBOARD.builder.options.columnResize);
    $.each(column.rows.sortByPosition(), function(i, row){
        var cardsOl = $.tag("ol", { className : 'cards' });
        cardsOl = $(cardsOl);
        cardsOl.data("data", row).addClass("row").addClass("row_" + row.id);
        if(TASKBOARD.editor){
            cardsOl.sortable(TASKBOARD.builder.options.cardSort);
        }
        var cardsCount = 0;
        if(column.cardsMap && column.cardsMap[row.id]){
            $.each(column.cardsMap[row.id].sortByPosition(), function(j, card){
                cardElem = TASKBOARD.builder.buildCardFromJSON(card);
                if(column.position > 1 && row.fold)
                    cardElem.hide();
                cardsOl.append(cardElem);
                cardsCount++;
            });
        }
        if(cardsCount > 0 && column.position > 1 && row.fold)
            cardsOl.addClass("foldedrow");
        columnLi.append(cardsOl);
    });
    var width = TASKBOARD.cookie.getColumnWidth(column.id) ? parseInt(TASKBOARD.cookie.getColumnWidth(column.id), 10) : "";
    columnLi.width(width);
    // edit-mode-only
    if(TASKBOARD.editor){
        columnLi.find("h2")
            .editable(function(value, settings){
                    var id = $(this).closest(".column").data('data').id;
                    TASKBOARD.remote.api.renameColumn(id, value);
                    $(this).closest(".column").data('data').name = value;
                    return value.escapeHTML();
                }, { event : "dblclick",
                    data : function(){ return $(this).closest(".column").data('data').name; },
                    callback: function(){ TASKBOARD.utils.expandColumnsHeight(); }
             })
            .attr("title", TASKBOARD.builder.strings.columnHeaderTitle);
        // edit-mode-only
        columnLi.find(".deleteColumn")
            .bind("click", function(ev){
                ev.preventDefault();
                var closestColumn = $(this).closest('.column');
                if(closestColumn.find("ol.cards").children().length !== 0){
                    $(this).warningTooltip("You cannot delete a column that is not empty!");
                } else if ($("#taskboard .column").length == 1) {
                    $(this).warningTooltip("You cannot delete last column!");
                }else {
                    TASKBOARD.remote.api.deleteColumn(closestColumn.data('data').id);
                    closestColumn.fadeOut(1000, function(){ $(this).remove(); } );
                }
            });

        columnLi.find(".cleanColumn")
            .bind("click", function(ev){
                ev.preventDefault();
                var closestColumn = $(this).closest('.column');
                if(closestColumn.find("ol.cards").children().length == 0){
                    $(this).warningTooltip("Column have no cards!");
                }else if(confirm("Are you sure to delete all cards from column?")){
                    TASKBOARD.remote.api.cleanColumn(closestColumn.data('data').id);
                    closestColumn.find("ol.cards").children().fadeOut(375, function(){ $(this).remove(); } );
                }
            });
    }
    return columnLi;
};

TASKBOARD.builder.buildRowMeta = function(row){
    var rowDiv = $.tag("div", { className : 'row' });
    rowDiv = $(rowDiv);
    rowDiv.data("data", row).addClass("row_" + row.id);
    if(TASKBOARD.editor){
        var actionFold = TASKBOARD.builder.actions.foldRow(row.id, row.fold);
        var actionsRow = $.tag("li", TASKBOARD.builder.actions.deleteRow() + actionFold);
        actionsRow += $.tag("li", TASKBOARD.builder.actions.cleanRow());
        rowDiv.append($.tag("ul", actionsRow, { className : 'actions' }));

        var infoRow = TASKBOARD.builder.actions.rowActions(row);
        if(row.sumHours){
            infoRow += $.tag('span', "S" + row.sumHours, { className : "RowSum", title : "hours of row" });
        }
        if(row.sumHoursAll){
            infoRow += $.tag('span', "C" + row.sumHoursAll, { className : "RowSum", title : "cumulated hours of rows" });
        }
        rowDiv.append(infoRow);

        rowDiv.find(".deleteRow")
            .bind("click", function(ev){
                ev.preventDefault();
                var cards = $(".column .row_" + row.id).children();
                if(cards.length !== 0){
                    $(this).warningTooltip("You cannot delete a row that is not empty!", { position: "rightMiddle" });
                } else if($("#metaLane .row").length == 1) {
                    $(this).warningTooltip("You cannot delete last row!", { position: "rightMiddle" });
                } else {
                    TASKBOARD.remote.api.deleteRow(row.id);
                    $(".row_" + row.id).fadeOut(1000, function(){ $(this).remove(); } );
                }
            });

        rowDiv.find(".cleanRow")
            .bind("click", function(ev){
                ev.preventDefault();
                var cards = $(".column .row_" + row.id).children();
                if(cards.length == 0) {
                    $(this).warningTooltip("Row have no cards!", { position: "rightMiddle" });
                } else if(row.fold) {
                    $(this).warningTooltip("Row can only be cleaned if row not folded!", { position: "rightMiddle" });
                } else if(confirm("Are you sure to delete all cards from row?")) {
                    TASKBOARD.remote.api.cleanRow(row.id);
                    cards.fadeOut(375, function(){ $(this).remove(); } );
                }
            });

        TASKBOARD.bindHandlerFoldRow( rowDiv.find("#fold_" + row.id), row );

        rowDiv.find(".rowActions")
            .bind("click", function(ev){
                TASKBOARD.openRowActions(row, $(this).offset().top - 5, $(this).offset().left + 30);
                ev.preventDefault();
                ev.stopPropagation();
            });
    }
    return rowDiv;
};

TASKBOARD.bindHandlerFoldRow = function(element, row){
    element.unbind();
    element.bind("click", function(ev){
            ev.preventDefault();
            var cards = $(".column:gt(0) .row_" + row.id).children(); // don't hide 1st col
            if(cards.length > 0){
                if(row.fold){
                    cards.show();
                    cards.parent("ol").removeClass("foldedrow");
                } else {
                    cards.hide();
                    cards.parent("ol").addClass("foldedrow");
                }
                TASKBOARD.remote.api.foldRow(row.id, row.fold);
                $(this).closest("div.row").data('data').fold = !row.fold;
            }
        });
};

TASKBOARD.builder.buildMetaLane = function(sumHoursMap){
    var metaLane = $($.tag("li", { id: "metaLane", className: "lane"}));
    var sumHoursAll = 0;
    $.each(TASKBOARD.data.rows.sortByPosition(), function(i, row){
        row.sumHours = (typeof sumHoursMap[row.id] === 'undefined') ? 0 : sumHoursMap[row.id];
        sumHoursAll = sumHoursAll + row.sumHours;
        row.sumHoursAll = sumHoursAll;
        var rowDiv = TASKBOARD.builder.buildRowMeta(row);
        metaLane.append(rowDiv);
    });
    return metaLane;
}

/*
 * Builds a card element from JSON data.
 */
TASKBOARD.builder.buildCardFromJSON = function(card){
    var cardLi = "";
    if(card.issue_no){
        cardLi += $.tag('span', $.tag('a', card.issue_no, { href : card.url, rel : 'external'}) + ": ",   { className : 'alias' });
    }

    var cardNotes = (card.notes) ? $.tag("img", '', { src : '/images/notes.png', title : 'Card has notes', className : 'CardHasNotes' }) : "";
    cardLi += $.tag("span", cardNotes + card.name.escapeHTML(), { className : 'title' });

    if(card.rd_id > 0)
        cardLi += $.tag("span", TASKBOARD.Format.formatCCPM(card, false), { id: "ccpm_" + card.id, className : 'ccpm' });

    cardLi += $.tag("span", "hours left: " + $.tag("span", card.hours_left, { className : 'hours' }), { className : 'progress' });

    if(card.tag_list.length){
        var tagsUl = "";
        $.each(card.tag_list, function(i, tag){
            tagsUl += $.tag("li", tag.escapeHTML());
        });
        tagsUl = $.tag("ul", tagsUl, { className : 'tags' });
        cardLi += tagsUl;
    }

    // build card actions
    var actionsUl = "";

    // edit-mode-only
    if(TASKBOARD.editor){
        actionsUl += $.tag("li", TASKBOARD.builder.actions.changeColorAction());
        actionsUl += $.tag("li", TASKBOARD.builder.actions.copyCardAction());
        actionsUl += $.tag("li", TASKBOARD.builder.actions.deleteCardAction());

        actionsUl = $.tag("ul", actionsUl, { className : 'actions' });
        cardLi += actionsUl;
    }

    cardLi = $.tag("li", cardLi, { id : 'card_' + card.id });
    cardLi = $(cardLi)
        .css("background-color", card.color)
        .data("data", card)
        .bind("dblclick", function(ev){
            TASKBOARD.openCard(this, $(this).data('data'));
        });

    $.each(card.tag_list, function(i, tag){
        cardLi.addClass('tagged_as_' + tag.toClassName());
    });
    if(card.rd_id > 0)
        cardLi.addClass('tagged_as_CCPM');

    // edit-mode-only
    if(TASKBOARD.editor){
        cardLi.find(".progress .hours").editable(function(val){
                /* not used with burn-down hours
                var updatedDateString = $(this).closest(".cards > li").data('data').hours_left_updated;
                var updatedToday = false;
                if(updatedDateString){
                    var updatedDate = new Date();
                    updatedDate.setISO8601($(this).closest(".cards > li").data('data').hours_left_updated);
                    var now = new Date();
                    if(now.getYear() == updatedDate.getYear() && now.getMonth() == updatedDate.getMonth() && now.getDate() == updatedDate.getDate()){
                        updatedToday = true;
                    }
                }
                if((!updatedToday || confirm("You already updated hours today. Are you sure you want to change them?\n\n" +
                                             "Click 'Cancel' to leave hours unchanged and wait till tomorrow or (if you are really sure) click 'OK' to save hours.")) &&
                                             !isNaN(val) && val >= 0) {
                */
                if(!isNaN(val) && val >= 0) {
                    TASKBOARD.remote.api.updateCardHours($(this).parent().parent().data('data').id, val);
                    $(this).parent().parent().data('data').hours_left = val;
                    return val;
                } else {
                    return this.revert;
                }
            });

        if(card.rd_id > 0) {
            cardLi.find("#edit_ccpm_days_" + card.id)
                .editable(function(val){
                    var doReset = (val == 'R');
                    if( doReset ) val = this.revert;
                    if(doReset || ( !isNaN(val) && val >= 0 ) ) {
                        TASKBOARD.remote.api.updateCardRemainingDaysDays(card.id, val, /*need-read*/!doReset);
                        $(this).closest(".cards > li").data('data').rd_days = val;
                        $(this).closest(".cards > li").data('data').rd_needread = (doReset) ? 0 : 1;
                        $(this).closest(".cards > li").data('data').rd_updated = new Date();
                        $(this).closest("span#ccpmDaysInfo").toggleClass("ccpmNeedsUpdate", doReset);
                        return val;
                    } else {
                        return this.revert;
                    }
                });
        }

        cardLi.find(".deleteCard").click(function(ev){
                if(confirm("Do you really want to delete this card?")){
                    TASKBOARD.remote.api.deleteCard($(this).closest(".cards > li").data('data').id);
                    $(this).closest(".cards > li").fadeOut(1000, function(){$(this).remove();} );
                }
                ev.preventDefault();
            });

        cardLi.find(".changeColor").click(function(ev){
                var card = $(this).closest(".cards > li");
                TASKBOARD.openColorPicker(card, $(this).offset().top - 8, $(this).offset().left + 12);
                ev.preventDefault();
                ev.stopPropagation();
            });

        cardLi.find(".copyCard").click(function(ev){
                var card = $(this).closest(".cards > li").data('data');
                var copyCard = ev.ctrlKey;
                TASKBOARD.remote.api.copyCard(card.id, copyCard);
                ev.preventDefault();
                ev.stopPropagation();
            });
    }
    return cardLi;
};

TASKBOARD.builder.buildBigCard = function(card){
    var cardDl = "";
    cardDl += $.tag("dt", "Actions", { id: "cardActionsTitle"});

    if(TASKBOARD.editor){
        var actions = $.tag("li", TASKBOARD.builder.actions.changeColorAction())
                        + $.tag("li", TASKBOARD.builder.actions.addCCPMInfoAction(), { id: "addCCPMInfo" });
        actions = $.tag("ul", actions, { className: "big actions"});
        cardDl += $.tag("dd", actions, { id: "cardActions"});
    }

    if(card.issue_no) {
        cardDl +=  $.tag("dt", "Issue");
        cardDl +=  $.tag("dd", card.issue_no.escapeHTML());

        cardDl +=  $.tag("dt", "URL");
        cardDl +=  $.tag("dd", $.tag("a", card.url, { href : card.url, rel : 'external' }));
    }
    cardDl += $.tag("dt", "Name");
    cardDl += $.tag("dd", card.name.escapeHTML(), { id : "name", className : "editable" });

    cardDl += $.tag("dt", TASKBOARD.Format.formatCCPMId(card.rd_id, true), { id: "ccpmLabel", className: "ccpmInfo" });
    cardDl += $.tag("dd", TASKBOARD.Format.formatCCPM(card, true), { id: "ccpmInfo", className: "ccpmInfo" });

    var notes = card.notes ? (new Showdown.converter()).makeHtml(card.notes.escapeHTML()) : "";
    cardDl += $.tag("dt", "Notes");
    cardDl += $.tag("dd", notes, { id : "notes", className : "editable" });

    var tagsUl = "";
    $.each(card.tag_list, function(){
        var tagLi = $.tag("span", this.escapeHTML(), { className : "tag" });
        if(TASKBOARD.editor){
            tagLi += $.tag("a", "X", { className : "deleteTag", href : "#" });
        }
        tagsUl += $.tag("li", tagLi);
    });
    tagsUl = $.tag("ul", tagsUl, { className : 'tags' });

    cardDl += $.tag("dt", "Tags");
    cardDl += $.tag("dd", tagsUl, { id: 'tags' });

    // edit-mode-only
    if(TASKBOARD.editor){
        var tagsForm = $.tag("input", { type : "text", value : "Add tags...", id : 'inputTags', name : 'inputTags', size : 30 });
        tagsForm = $.tag("form", tagsForm, { id : 'tagsForm' });
        tagsForm = $.tag("dd", tagsForm);
        cardDl += tagsForm;
    }

    cardDl += $.tag("dt", "Hours left");
    cardDl += $.tag("dd", card.hours_left, { id : "progress", className: "editable" });

    cardDl = $.tag("dl", cardDl, { id: 'bigCard', className : 'bigCard'});

    var bigCard = $(cardDl).css({ backgroundColor : card.color });
    if(card.rd_id <= 0 )
        $(bigCard).find(".ccpmInfo").hide();
    else
        $(bigCard).find(".addCCPMInfo").hide();

    // edit-mode-only
    if(TASKBOARD.editor){
        var deleteTagCallback = function(ev){
            var tag = $(this).parent().find(".tag").text();
            TASKBOARD.remote.api.removeTag(card.id, tag);
            var index = card.tag_list.indexOf(tag);
            card.tag_list.splice(index, 1);
            TASKBOARD.api.updateCard({ card: card });
            TASKBOARD.remote.api.removeTag(card.id, tag);
            $(this).parent().remove();
            ev.preventDefault();
            ev.stopPropagation();
        };

        bigCard.find(".changeColor").click(function(ev){
            TASKBOARD.openColorPicker(bigCard, $(this).offset().top - 5, $(this).offset().left + 12);
            ev.preventDefault();
            ev.stopPropagation();
        });

        bigCard.find(".addCCPMInfo").click(function(ev){
            $(".addCCPMInfo").hide();
            $("#ccpmLabel").show();
            $("#edit_ccpm_id").text("ID");
            ev.preventDefault();
            ev.stopPropagation();
        });

        bigCard.find('#tagsForm').submit(function(ev){
            var cardTags = $.map(card.tag_list, function(n){ return n.toUpperCase() });
            var tags = $(this).find(':text').val();
            // remove empty and already added tags
            tags = $.map(tags.split(','), function(n){ return (n.trim() && ($.inArray(n.trim().toUpperCase(),cardTags) < 0)) ? n.trim() : null; });
            var uniqueTags = []
            $.each(tags, function(i,v){
                if($.inArray(v.toUpperCase(), cardTags) < 0){
                    uniqueTags.push(v);
                    cardTags.push(v.toUpperCase());
                }
            });
            $.merge(card.tag_list, uniqueTags);
            TASKBOARD.api.updateCard({ card: card });
            if(uniqueTags.length > 0){
                TASKBOARD.remote.api.addTags(card.id, uniqueTags.join(','));
            }
            // TODO: wait for response?
            $("#tags ul").html("");
            $.each(card.tag_list, function(){
                var tagLi = $.tag("span", this.escapeHTML(), { className : "tag" }) +
                            $.tag("a", "X", { className : "deleteTag", href : "#" });
                $("#tags ul").append($.tag("li", tagLi));
                $("#tags .deleteTag").bind('click', deleteTagCallback);
            });
            ev.preventDefault();
        }).find(":text").click(function() { $(this).val(""); });

        bigCard.find('#inputTags').helpTooltip(TASKBOARD.builder.strings.tagsTooltip);

        bigCard.find('#name')
            .editable(function(value, settings){
                    TASKBOARD.remote.api.renameCard(card.id, value);
                    card.name = value;
                    TASKBOARD.api.updateCard({ card: card }); // redraw small card
                    return value.escapeHTML();
                }, { height: 'none', width: '100%',
                     submit : 'Save', cancel : 'Cancel', onblur : 'ignore',
                     data : function(){ return $(this).closest('dl').data('data').name; },
                     readyCallback: function(){ $(this).removeClass("hovered"); }
            })
            .bind("mouseenter.editable", function(){ if($(this).find("form").length){ return; } $(this).addClass("hovered");})
            .bind("mouseleave.editable", function(){ $(this).removeClass("hovered"); });

        bigCard.find('#notes')
            .editable(function(value){
                    TASKBOARD.remote.api.updateCardNotes(card.id, value);
                    card.notes = value;
                    return value ? (new Showdown.converter()).makeHtml(value.escapeHTML()) : "";
                }, { height: '200px', width: '100%',
                     type : 'textarea', submit : 'Save', cancel : 'Cancel', onblur : 'ignore',
                     data : function(){ return $(this).closest('dl').data('data').notes || ""; },
                     readyCallback : function(){
                        $(this).removeClass("hovered").find("textarea").helpTooltip(TASKBOARD.builder.strings.notesTooltip);
                    }
            })
            .bind("mouseenter.editable", function(){ if($(this).find("form").length){ return; } $(this).addClass("hovered"); })
            .bind("mouseleave.editable", function(){ $(this).removeClass("hovered"); });

        bigCard.find('#progress')
            .editable(function(val){
                if(!isNaN(val) && val >= 0) {
                    TASKBOARD.remote.api.updateCardHours(card.id, val, $(this).find("select").val(), function() {
                        // burndown-func overwritten for DomDev
                        //TASKBOARD.remote.get.cardBurndown(card.id, function(data){
                            //TASKBOARD.burndown.render($('#cardBurndown'), data);
                        //});
                    });
                    card.hours_left = val;
                    TASKBOARD.api.updateCard({ card: card }); // redraw small card
                    return val;
                } else {
                    return this.revert;
                }
            }, { type : 'textselect', onblur : 'ignore', submit : 'Save', cancel : 'Cancel',
                readyCallback: function(){ $(this).removeClass("hovered"); }
            })
            .bind("mouseenter.editable", function(){ if($(this).find("form").length){ return; } $(this).addClass("hovered"); })
            .bind("mouseleave.editable", function(){ $(this).removeClass("hovered"); });

        bigCard.find('#edit_ccpm_id')
            .editable(function(val){
                if(!isNaN(val) && val > 0) { // valid ID -> update ID + enable days
                    TASKBOARD.remote.api.updateCardRemainingDaysId(card.id, val);
                    card.rd_id = val;
                    $("#ccpmInfo").show().effect('highlight', {}, 1000);
                    TASKBOARD.api.updateCard({ card: card }); // redraw small card
                    return val;
                } else { //if(isNaN(val) || val <= 0) // invalid-ID -> clear/disable CCPM + disable days
                    TASKBOARD.remote.api.updateCardClearRemainingDays(card.id);
                    card.rd_id = 0;
                    card.rd_days = 0;
                    card.rd_needread = 0;
                    card.rd_updated = null;
                    $(".addCCPMInfo").show();
                    $(".ccpmInfo").hide();
                    TASKBOARD.api.updateCard({ card: card }); // redraw small card
                    return this.revert;
                }
            }, {
                readyCallback: function(){ $(this).removeClass("hovered"); }
            })
            .bind("mouseenter.editable", function(){ if($(this).find("form").length){ return; } $(this).addClass("hovered"); })
            .bind("mouseleave.editable", function(){ $(this).removeClass("hovered"); });

        bigCard.find('#edit_ccpm_days')
            .editable(function(val){
                var doReset = (val == 'R');
                if( doReset ) val = this.revert;
                if(doReset || ( !isNaN(val) && val >= 0 ) ) {
                    TASKBOARD.remote.api.updateCardRemainingDaysDays(card.id, val, /*need-read*/!doReset );
                    card.rd_days = val;
                    card.rd_needread = (doReset) ? 0 : 1;
                    card.rd_updated = new Date();
                    $("span#ccpmUpdated").text( TASKBOARD.Format.formatDate(card.rd_updated) ).effect('highlight', {}, 1000);
                    $("span#ccpmUpdated2").text( (doReset ? "UPDATE" : "READING") ).effect('highlight', {}, 1000);
                    TASKBOARD.api.updateCard({ card: card }); // redraw small card
                    return val;
                } else {
                    return this.revert;
                }
            }, {
                readyCallback: function(){ $(this).removeClass("hovered"); }
            })
            .bind("mouseenter.editable", function(){ if($(this).find("form").length){ return; } $(this).addClass("hovered"); })
            .bind("mouseleave.editable", function(){ $(this).removeClass("hovered"); });

        bigCard.find('#tags .deleteTag').bind('click', deleteTagCallback);
    }

    bigCard.data('data',card);
    return bigCard;
};

/*
 * Utilities for managing Add cards and Add column form
 * =========================================================
 */
TASKBOARD.form = {
    /* Keeps currently opened form */
    current : "",

    /* Actions performed by form */
    actions : {
        addCards : function(){
            var value = $('#inputAddCards').val().trim();
            if(value.length === 0){
                $('#inputAddCards').effect("highlight", { color: "#FF0000" }).focus();
                return false;
            }
            var columnId = $('#selectColumn').val();
            TASKBOARD.remote.api.addCards(value, columnId);
            TASKBOARD.form.close();
            return false;
        },

        addColumn : function(){
            var value = $('#inputAddColumn').val().trim();
            if(value.length === 0){
                $('#inputAddColumn').effect("highlight", { color: "#FF0000" }).focus();
                return false;
            }
            TASKBOARD.remote.api.addColumn(value);
            TASKBOARD.form.close();
            return false;
        },

        initBurndown : function(){ // form-action
            var dates_str = $('#inputBurndownDates').val().trim() + " ";
            if(dates_str.length > 0 && !dates_str.match(/^((0?[1-9]|[12]\d|3[01])\.(0?[1-9]|[12]\d|3[01])\.(2\d{3})?\s+)+$/)){
                $('#inputBurndownDates').effect("highlight", { color: "#FF0000" }).focus();
                return false;
            }

            var cols_arr = []; // col.id, 0|1 (=coltype)
            $('#selectBurndownCols option').each(function() {
                cols_arr.push( $(this).val() );
                cols_arr.push( ($(this).attr('selected')) ? 1 : 0 );
            });

            var duetime = $('#inputBurndownDuetime').val().trim();
            if(duetime.length > 0 && !duetime.match(/^\d?\d:\d\d$/)){
                $('#inputBurndownDuetime').effect("highlight", { color: "#FF0000" }).focus();
                return false;
            }
            var capacity = $('#inputBurndownCapacity').val().trim();
            if(capacity.length > 0 && !capacity.match(/^[0-9]+$/)){
                $('#inputBurndownCapacity').effect("highlight", { color: "#FF0000" }).focus();
                return false;
            }
            var slack = $('#inputBurndownSlack').val().trim();
            if(slack.length > 0 && !slack.match(/^[0-9]+$/)){
                $('#inputBurndownSlack').effect("highlight", { color: "#FF0000" }).focus();
                return false;
            }
            var commit_po = $('#inputBurndownCommitmentPO').val().trim();
            if(commit_po.length > 0 && !commit_po.match(/^[0-9]+$/)){
                $('#inputBurndownCommitmentPO').effect("highlight", { color: "#FF0000" }).focus();
                return false;
            }
            var commit_team = $('#inputBurndownCommitmentTeam').val().trim();
            if(commit_team.length > 0 && !commit_team.match(/^[0-9]+$/)){
                $('#inputBurndownCommitmentTeam').effect("highlight", { color: "#FF0000" }).focus();
                return false;
            }
            var velocity = $('#inputBurndownVelocity').val().trim();
            if(velocity.length > 0 && !velocity.match(/^[1-9]\d*(\.\d+)?%?$/)){
                $('#inputBurndownVelocity').effect("highlight", { color: "#FF0000" }).focus();
                return false;
            }

            TASKBOARD.remote.api.updateInitBurndown(dates_str, cols_arr.join(' '), duetime, capacity, slack, commit_po, commit_team, velocity);
            TASKBOARD.form.close();
            return false;
        },

        fixBurndown : function(){ // form-action
            var date_str = $('#inputFixBurndownDate').val();
            if(date_str.length < 10){
                $('#inputFixBurndownDate').effect("highlight", { color: "#FF0000" });
                return false;
            }
            var hour_str = $('#inputFixBurndownHours').val().trim();
            if(hour_str.length == 0 || !hour_str.match(/^[\+\-]?\d+$/)){
                $('#inputFixBurndownHours').effect("highlight", { color: "#FF0000" }).focus();
                return false;
            }

            TASKBOARD.remote.api.updateFixBurndown(date_str, hour_str);
            TASKBOARD.form.close();
            return false;
        }
    },

    /*
     * Submits data to server.
     * Detects currently opened form and chooses proper action.
     * @see this.actions
     */
    submit : function(){
        var self = TASKBOARD.form;
        // get action name from current fieldset id
        var action = self.current.replace(/#([a-z]+)/,'').lowerFirst();
        self.actions[action]();
        return false;
    },

    toggle : function(id){
        id === this.current ? this.close() : this.open(id);
    },

    open : function(id){
        $("#formActions fieldset").hide();
        $(id).show();
        $("#formActions")
            .show("slide", { direction: "up" }, "fast", function(){
                $(id + " :text").focus();
            });

        this.current = id;
    },

    close : function(){
        var self = TASKBOARD.form;
        $("#formActions")
            .hide("slide", { direction: "up" }, "fast", function(){
                $("#actions li").removeClass("current");
                $("#formActions fieldset").hide();
                $("#formActions :text").val("");
                self.current = "";
            });
    },

    updateColumnSelect : function(){
        var options = [];
        $('#taskboard .column').each(function(){
            var title = $(this).find("h2").text();
            var id = $(this).data("data").id;
            options.push($.tag("option", title, { value : id }));
        });
        var select = $("#selectColumn").html(options.join(''));
        var fieldset = select.closest("fieldset");

        fieldset.show().closest("form").css({visibility: "hidden"}).show();
        var othersWidth = select.outerWidth() + fieldset.find("span").outerWidth() + fieldset.find(":submit").outerWidth() + 25; // 25px is for spaces etc.
        $("#inputAddCards").width(fieldset.width() - othersWidth);
        fieldset.hide().closest("form").hide().css({visibility: ""});
    },

    updateInitBurndown : function(initburndown){ // form
        var options = [];
        $('#taskboard .column').each(function(){
            var column = $(this).data("data");
            if(column.coltype == 1){
                options.push($.tag("option", column.name, { value: column.id, selected: "selected" }));
            } else {
                options.push($.tag("option", column.name, { value: column.id }));
            }
        });
        $("#selectBurndownCols").html(options.join(''));

        if(initburndown){
            $("#inputBurndownDates").val(initburndown.dates);
            $("#inputBurndownDuetime").val(initburndown.duetime_as_str)
            $("#inputBurndownCapacity").val(initburndown.capacity);
            $("#inputBurndownSlack").val(initburndown.slack);
            $("#inputBurndownCommitmentPO").val(initburndown.commitment_po);
            $("#inputBurndownCommitmentTeam").val(initburndown.commitment_team);
            $("#inputBurndownVelocity").val(TASKBOARD.formatVelocity(initburndown.velocity));
        }
    },

    updateFixBurndown : function(data){ // form
        var capa = data.capacity;
        $('#fixBurndownCapacity').text(capa);
        $('#inputFixBurndownDate').val('');
        $('#inputFixBurndownHours').val('');

        var duetime = data.duetime_as_str;
        var hours_arr = data.hours;
        $('#fieldsetFixBurndown #fixTable tr.date').remove();
        for( i=0; i < hours_arr.length; i++ ){
            var date_str = hours_arr[i][0];
            var hours = hours_arr[i][1];
            capa -= hours;
            a_date = $.tag("a", date_str, { className: 'editdate', title: "Edit hours", href: '#' }); // text must be date-str YYYY-MM-DD
            row_td = $.tag("td", "&lt; " + a_date + " " + duetime); //date-str
            row_td += $.tag("td", hours);
            row_td += $.tag("td", capa);
            tablerow = $.tag("tr", row_td, { className : 'date' });
            $('#fieldsetFixBurndown #fixTable').append(tablerow);
        }

        $('#fieldsetFixBurndown #fixTable a.editdate').bind('click', function(ev){
            $('#inputFixBurndownDate').val( $(this).text() );
            $('#inputFixBurndownHours').val('').effect("highlight", { color: "#FF0000" }).focus();
        });
    }
};

/*
 * Functions to load and build taskboard elements from AJAX calls
 * ==================================================================
 */
TASKBOARD.api = {
    /*
     * Adds a column from JSON as a first column of taskboard.
     */
    addColumn : function(column){
        if(column.column){
            column = column.column;
        }
        var rows = [];
        $("#taskboard .lane:first .row").each(function(){ rows.push($(this).data("data")); });
        column.rows = rows;
        TASKBOARD.builder.buildColumnFromJSON(column)
            .insertBefore($("#taskboard .column:first"))
            .effect("highlight", {}, 2000);
        TASKBOARD.utils.expandTaskboard();
        TASKBOARD.form.updateColumnSelect();
        TASKBOARD.remote.loading.stop();
    },

    moveColumn : function(column){
        column = column.column;
        var columnLi = $('#column_' + column.id);
        var currentPosition = $("#taskboard .column").index(columnLi) + 1;
        if(currentPosition > column.position){
            $($('#taskboard').children(".column")[column.position - 1]).before(columnLi);
        } else if(currentPosition < column.position){
            $($('#taskboard').children(".column")[column.position - 1]).after(columnLi);
        }
        columnLi.effect('highlight', {}, 1000);
        TASKBOARD.form.updateColumnSelect();
    },

    /*
     * Adds a column from JSON as a last row of taskboard.
     */
    addRow : function(row){
        if(row.row){
            row = row.row;
        }
        var rowMeta = TASKBOARD.builder.buildRowMeta(row);
        $("#taskboard #metaLane").append(rowMeta);
        $("#taskboard .column").each(function(){
            var cardsOl = $.tag("ol", { className : 'cards' });
            cardsOl = $(cardsOl);
            cardsOl.data("data", row).addClass("row").addClass("row_" + row.id);
            if(TASKBOARD.editor){
                cardsOl.sortable(TASKBOARD.builder.options.cardSort);
            }
            $(this).append(cardsOl);
        });
        $(".row_" + row.id).effect("highlight", {}, 2000);
        TASKBOARD.utils.expandTaskboard();
    },

    /*
     * Moved row to new position.
     */
    moveRow : function(row){
        TASKBOARD.refresh();
    },

    /*
     * Copied all cards from another row into current row.
     */
    copyRow : function(row){
        TASKBOARD.refresh();
    },

    /*
     * Loads cards from JSON into first column.
     */
    addCards : function(cards){
        $.each(cards, function(i, card){
            card = card.card;
            $("#column_" + card.column_id + " ol.cards").eq(0).prepend(TASKBOARD.builder.buildCardFromJSON(card));
        });
        TASKBOARD.utils.expandTaskboard();
        TASKBOARD.remote.loading.stop();
        TASKBOARD.tags.updateTagsList();
        TASKBOARD.tags.updateCardSelection();
    },

    /*
     * Copies card (as empty or full copy) loading from JSON into new position.
     */
    copyCard : function(card){
        card = card.card;
        var cardLi = TASKBOARD.builder.buildCardFromJSON(card);
        var targetCell = $("#column_" + card.column_id + " .row_" + card.row_id);

        targetCell.append(cardLi);
        if(targetCell.children().length != card.position){
            targetCell.children().eq(card.position - 1).before(cardLi);
        }

        cardLi.effect('highlight', {}, 1000);
        TASKBOARD.utils.expandTaskboard();
        TASKBOARD.remote.loading.stop();
        TASKBOARD.tags.updateTagsList();
        TASKBOARD.tags.updateCardSelection();
    },

    moveCard : function(card){
        card = card.card;
        var cardLi = $('#card_' + card.id),
            currentPosition = cardLi.parent().children().index(cardLi) + 1,
            currentColumn = cardLi.parent().parent().data('data').id,
            currentRow = cardLi.parent().data('data').id;

        if((currentColumn !== card.column_id) || (currentRow !== card.row_id) || (currentPosition !== card.position)){
            var targetCell = $("#column_" + card.column_id + " .row_" + card.row_id);
            targetCell.append(cardLi);
            if(targetCell.children().length != card.position){
                targetCell.children().eq(card.position - 1).before(cardLi);
            }
        }
        cardLi.effect('highlight', {}, 1000);
        TASKBOARD.utils.expandTaskboard();
    },

    deleteCard : function(card){
        card = card.card;
        var cardLi = $('#card_' + card.id);
        cardLi.fadeOut(1000, function(){
            $(this).remove();
            TASKBOARD.utils.expandTaskboard();
            TASKBOARD.tags.updateTagsList();
            TASKBOARD.tags.updateCardSelection();
        });
    },

    deleteColumn : function(column){
        column = column.column;
        var columnLi = $('#column_' + column.id);
        columnLi.fadeOut(1000, function(){$(this).remove();} );
        TASKBOARD.form.updateColumnSelect();
        TASKBOARD.utils.expandTaskboard();
    },

    cleanColumn : function(column){
        column = column.column;
        var cards = $('#column_' + column.id).find("ol.cards").children();
        cards.fadeOut(375, function(){ $(this).remove(); } );
    },

    deleteRow : function(row){
        row = row.row;
        var row = $('.column .row_' + row.id);
        row.fadeOut(1000, function(){$(this).remove();} );
        TASKBOARD.utils.expandTaskboard();
    },

    cleanRow : function(row){
        row = row.row;
        var cards = $(".column .row_" + row.id).children();
        cards.fadeOut(375, function(){$(this).remove();} );
    },

    renameColumn : function(column){
        column = column.column;
        $('#column_' + column.id + ' h2')
            .text(column.name)
            .effect('highlight', {}, 1000);
        TASKBOARD.form.updateColumnSelect();
    },

    renameCard : function(card){
        card = card.card;
        $('#card_' + card.id + ' .title')
            .text(card.name)
            .effect('highlight', {}, 1000);
    },

    // TODO: update also big card
    updateCard : function(card){
        card = card.card;
        var newCard = TASKBOARD.builder.buildCardFromJSON(card);
        $('#card_' + card.id).before(newCard).remove();
        newCard.effect('highlight', {}, 1000);
        TASKBOARD.tags.updateTagsList();
        TASKBOARD.tags.updateCardSelection();
    },

    // TODO: update also big cards
    updateCards : function(cards){
        for( i = 0; i < cards.length; i++) {
            var card = cards[i].card;
            var newCard = TASKBOARD.builder.buildCardFromJSON(card);
            $('#card_' + card.id).before(newCard).remove();
            newCard.effect('highlight', {}, 1000);
        }
        TASKBOARD.tags.updateTagsList();
        TASKBOARD.tags.updateCardSelection();
    },

    renameTaskboard : function(name){
        document.title = name + " - Taskboard";
        $('h1 span.title')
            .text(name)
            .effect('highlight', {}, 1000);
    },

    changeCardColor : function(card){
        card = card.card;
        var cardElements = $('#card_' + card.id).add("#bigCard");
        cardElements.css({ backgroundColor : card.color });
        cardElements.data('data').color = card.color;
    },

    /*
     * Updates taskboard after updating InitBurndown-setup.
     * - cols_types: change CSS-style of column-title
     */
    updateInitBurndown : function(cols_types){ // api
        // toggle Burndown-status of column: change CSS-style of column-titles
        if(cols_types.length > 0){
            var cols_arr = cols_types.split(' ');
            for( i = 0; i < cols_arr.length; i += 2 ){
                var col_id = cols_arr[i];
                var isBurndownCol = (cols_arr[i+1]/*coltype*/ == 1);
                $('#taskboard #column_' + col_id).data('data').coltype = (isBurndownCol) ? 1 : 0;
                $('#column_' + col_id + ' h2')
                    .toggleClass('Burndown', isBurndownCol)
                    .effect('highlight', {}, 1000);
            }
        }
    },

    /*
     * Updates taskboard after fixing burndown.
     */
    updateFixBurndown : function(){ // api
        // no action so far
    },

    /*
     * Expand or collapse a rows, i.e. showing or hiding cards of row except all cards in first column.
     */
    foldRow : function(row){
        row = row.row;

        // repeat show/hide for other remote-clients; see also TASKBOARD.bindHandlerFoldRow()
        var cards = $(".column:gt(0) .row_" + row.id).children(); // don't hide 1st col
        if(cards.length > 0){
            if(row.fold){
                cards.hide();
                cards.parent("ol").addClass("foldedrow");
            } else {
                cards.show();
                cards.parent("ol").removeClass("foldedrow");
            }
        }

        $('#taskboard #fold_' + row.id).replaceWith( TASKBOARD.builder.actions.foldRow(row.id, row.fold) );
        var foldLinkElem = $('#taskboard #fold_' + row.id);
        TASKBOARD.bindHandlerFoldRow( foldLinkElem, row );

        TASKBOARD.utils.expandTaskboard();
    }
};

/*
 * Initializes taskboard action links and forms functionality
 * before content is loaded by JSON.
 */
TASKBOARD.init = function(){
    var expand;
    var collapse = function(){
        $("#taskboard").addClass("collapsed");
        $(this).text("Expand All").one("click", expand);
        TASKBOARD.utils.expandColumnsHeight();
        return false;
    };

    expand = function(){
        $("#taskboard").removeClass("collapsed");
        $(this).text("Collapse All").one("click", collapse);
        TASKBOARD.utils.expandColumnsHeight();
        return false;
    };

    TASKBOARD.zoom = TASKBOARD.cookie.setTaskboardZoom(TASKBOARD.id) ? parseInt(TASKBOARD.cookie.setTaskboardZoom(TASKBOARD.id), 10) : 5;
    $("#taskboard").addClass("zoom_" + TASKBOARD.zoom);
    TASKBOARD.max_zoom = 5;
    var zoom = function(ev){
        $('#taskboard').removeClass("zoom_" + TASKBOARD.zoom);
        TASKBOARD.zoom = TASKBOARD.zoom < TASKBOARD.max_zoom ? TASKBOARD.zoom + 1 : 0;
        $('#taskboard').addClass("zoom_" + TASKBOARD.zoom);

        TASKBOARD.cookie.setTaskboardZoom(TASKBOARD.id, TASKBOARD.zoom);

        if(TASKBOARD.zoom < TASKBOARD.max_zoom){
            $(this).text("Zoom in");
        } else {
            $(this).text("Zoom out");
        }
        TASKBOARD.utils.expandTaskboard();

        ev.preventDefault();
    };
    $(".actionToggleAll").text("Zoom out").bind("click", zoom);
    if(TASKBOARD.zoom != TASKBOARD.max_zoom){
        $(".actionToggleAll").text("Zoom in");
    }

    $(".actionAddCards").bind("click", function(ev){
        $(this).parent().siblings().removeClass("current").end().toggleClass("current");
        TASKBOARD.form.toggle('#fieldsetAddCards');
        ev.preventDefault();
    });

    $(".actionAddColumn").bind("click", function(ev){
        $(this).parent().siblings().removeClass("current").end().toggleClass("current");
        TASKBOARD.form.toggle('#fieldsetAddColumn');
        ev.preventDefault();
    });

    $(".actionAddRow").bind("click", function(ev){
        TASKBOARD.remote.api.addRow();
        ev.preventDefault();
    });

    $(".actionShowTagSearch").bind("click", TASKBOARD.tags.showTagSearch);
    $("#filterTags a").live("click", TASKBOARD.tags.toggleShowTag);
    $("#fieldsetTags .actionMarkReadCCPM").bind("click", TASKBOARD.tags.ccpm.markRead);

    $(".actionShowBurndown").bind("click", this.showBurndown);

    $(".actionInitBurndown").bind("click", this.initBurndown);

    $(".actionFixBurndown").bind("click", this.fixBurndown);

    $("#formActions img").rollover();
    $("#formActions .actionHideForm").click(function(){ TASKBOARD.form.close(); $("#actions li").removeClass("current"); });
    $("#formActions").hide();
    $("#formActions").submit(TASKBOARD.form.submit);
};

/*
 * Loads taskboard content from JSON.
 *
 * TODO: refactor JSON parameter names
 * TODO: refactor the code
 */
TASKBOARD.loadFromJSON = function(taskboard){
    var self = TASKBOARD;
    taskboard = taskboard.taskboard;
    self.data = taskboard;

    var title = $($.tag("span", taskboard.name.escapeHTML(), { className : 'title' }));
    document.title = taskboard.name.escapeHTML() + " - Taskboard";
    if(TASKBOARD.editor){
        title.editable(function(value, settings){
            if(value.trim().length > 0) {
                TASKBOARD.remote.api.renameTaskboard(value);
                TASKBOARD.data.name = value;
                return value.escapeHTML();
            } else {
                $(this).warningTooltip("Name cannot be blank!");
                return this.revert;
            }
            }, { event : "dblclick", data : function(){ return TASKBOARD.data.name; } })
        .attr("title", TASKBOARD.builder.strings.columnHeaderTitle);
    }
    $("#header h1")
        .find("span.title").remove().end()
        .append(title);

    $("#taskboard").html("")

    // sum up hours for row + col
    var sumRowHoursMap = {};
    var sumColHoursMap = {};
    $.each(taskboard.cards, function(i, card){
        if(typeof sumRowHoursMap[card.row_id] === 'undefined'){
            sumRowHoursMap[card.row_id] = 0;
        }
        if(typeof sumColHoursMap[card.column_id] === 'undefined'){
            sumColHoursMap[card.column_id] = 0;
        }
        sumRowHoursMap[card.row_id] += card.hours_left;
        sumColHoursMap[card.column_id] += card.hours_left;
    });

    if(TASKBOARD.editor){
        var metaLane = TASKBOARD.builder.buildMetaLane(sumRowHoursMap);
        $("#taskboard").append(metaLane);
    }

    // build a mapping between cards and their position in columns/rows
    var cardsMap = {}
    $.each(taskboard.cards, function(i, card){
        if(typeof cardsMap[card.column_id] === 'undefined'){
            cardsMap[card.column_id] = {};
        }
        if(typeof cardsMap[card.column_id][card.row_id] === 'undefined'){
            cardsMap[card.column_id][card.row_id] = [];
        }
        cardsMap[card.column_id][card.row_id].push(card);
    });
    // build columns
    $.each(taskboard.columns.sortByPosition(), function(i, column){
        column.cardsMap = cardsMap[column.id];
        column.sumHours = (typeof sumColHoursMap[column.id] === 'undefined') ? 0 : sumColHoursMap[column.id];
        column.rows = taskboard.rows;
        $("#taskboard").append(TASKBOARD.builder.buildColumnFromJSON(column));
    });
    if(TASKBOARD.editor){
        $("#taskboard").sortable(TASKBOARD.builder.options.columnSort);
    }
    TASKBOARD.utils.expandTaskboard();
    TASKBOARD.form.updateColumnSelect();
    TASKBOARD.tags.updateTagsList();
};

TASKBOARD.burndown = {};

TASKBOARD.burndown.options = {
    /* original burndown options
    xaxis: {
        mode: "time",
        timeformat: "%d-%b",
        tickSize: [1, "day"]
    },
    yaxis: { min: 0 },
    bars: {
        show: true,
        barWidth: 24 * 60 * 60 * 1000, // unit is a millisecond and a bar should have 1 day width
        align: 'center'
    },
    grid : { backgroundColor: 'white' }
    */
};

TASKBOARD.burndown.render = function(element, data){
    // data = { initburndown => , count => , data => [ [x,y], ...]
    var self = TASKBOARD;
    var initburndown = data.initburndown.initburndown;
    var capacity = initburndown.capacity;
    var velocity = initburndown.velocity;
    var plotdata = [];
    var cnt_entries = data['count'];
    var hours = data['data'];
    var cnt_days = hours.length;

    // series: 0-axis
    var series = {
        color: 5,
        data: [ [1,0], [cnt_days + 1,0] ], // x-axis
        lines: {
            show: true,
            lineWidth: 2,
            shadowSize: 0
        }
    };
    plotdata.push( series );

    // series: PO-commit
    var y_commitment_po = capacity - initburndown.commitment_po;
    series = {
        color: 1,
        data: [ [1,capacity], [cnt_days, y_commitment_po] ],
        label: "PO-Commitment: " + initburndown.commitment_po,
        lines: { show: true }
    };
    plotdata.push( series );

    // series: Team-commit
    var y_commitment_team = capacity - initburndown.commitment_team;
    series = {
        color: 2,
        data: [ [1,capacity], [cnt_days, y_commitment_team] ],
        label: "Team-Commitment: " + initburndown.commitment_team,
        lines: { show: true }
    };
    plotdata.push( series );

    // series: hours
    var currHours = capacity;
    var data_hours = [];
    for( i=0; i < cnt_entries; i++){
        currHours -= hours[i][1];
        data_hours.push( [ i + 1, currHours ] );
    }
    series = {
        color: 0,
        data: data_hours,
        label: "Burndown",
        lines: {
            show: true
        },
        points: {
            show: true,
            fill: false,
            radius: 3
        }
    };
    plotdata.push( series );
    var velocity_new = (capacity > 0) ? velocity * (capacity - currHours) / capacity : velocity;

    // series: Slack
    var y_slack = capacity - initburndown.slack;
    series = {
        color: 3,
        data: [ [cnt_days, y_slack] ],
        label: "Slack: " + initburndown.slack,
        points: {
            show: true,
            fill: true,
            fillColor: false,
            radius: 5
        }
    };
    plotdata.push( series );

    var options = {
        // colors: 0=Hours, 1=PO-Commit, 2=Team-Commit, 3=Slack, 4=Velocity, 5=Text
        colors: [ '#cc0044', '#ff9966', '#33cc33', '#3399ff', '#6600ff', '#000000' ],
        legend: {
            position: 'ne'
        },
        xaxis: {
            min: 1,
            max: cnt_days + 1,
            ticks: [],
        },
        yaxis: {
            max: capacity + 20
        },
        grid: {
            backgroundColor: { colors: [ 'white', '#f2f2f2' ] }
        }
    };
    currHours = capacity;
    for( i=0; i < cnt_days; i++){
        currHours -= hours[i][1];
        date_str = (i == cnt_days - 1) ? "(" + hours[i][0] + ")" : hours[i][0];
        options.xaxis.ticks.push( [ i + 1, date_str + (i == 0 || i < cnt_entries ? "<br>" + currHours : "") ] );
    }
    options.xaxis.ticks.push( [ i, "" ] );
    var plot = $.plot(element, plotdata, options);

    // annotations
    element.append('<div style="position:absolute;left:450px;top:15px;text-align:center"><h2>' + self.data.name.escapeHTML() + '</h2></div>');
    o = plot.pointOffset({ x: cnt_days, y: y_commitment_po }); // PO-commit
    element.append('<div style="position:absolute;left:' + (o.left + 10) + 'px;top:' + (o.top - 8) + 'px;font-size:smaller">' + y_commitment_po + '</div>');
    o = plot.pointOffset({ x: cnt_days, y: y_commitment_team }); // Team-commit
    element.append('<div style="position:absolute;left:' + (o.left + 10) + 'px;top:' + (o.top - 8) + 'px;font-size:smaller">' + y_commitment_team + '</div>');
    o = plot.pointOffset({ x: cnt_days, y: y_slack }); // slack
    element.append('<div style="position:absolute;left:' + (o.left + 10) + 'px;top:' + (o.top - 8) + 'px;font-size:smaller">' + y_slack + '</div>');
    notes = "Capacity: " + capacity + "<br>Velocity: " + self.formatVelocity(velocity) + " (NEW " + self.formatVelocity(velocity_new) + ")";
    o = plot.pointOffset({ x: 1, y: 0 }); // at 0/0: capacity + velocity
    element.append('<div style="position:absolute;left:' + (o.left + 10) + 'px;top:' + (o.top - 40) + 'px;font-size:80%">' + notes + '</div>');

    /* original burndown rendering
    if(!data.length){
        var date = new Date();
        date.setMilliseconds(0); date.setSeconds(0); date.setMinutes(0); date.setHours(0);
        data.push([date.getTime(), 0]);
    }
    $.extend(TASKBOARD.burndown.options.xaxis, {
        min: data[0][0] - 16 * 60 * 60 * 1000,  // leave some margin between bars and axis
        max: data[data.length - 1][0] + ((data.length < 10 ? 10 - data.length : 0) * 24 + 16) * 60 * 60 * 1000
    });
    $.plot(element, [data], TASKBOARD.burndown.options);
    */
};

TASKBOARD.showBurndown = function(ev){
    ev.preventDefault();

    var self = TASKBOARD;
    TASKBOARD.remote.get.taskboardBurndown2(self.id, function(data){
        if(!$('#burndown').exists()){
            $('body').append('<div id="burndown"></div>');
        }

        // div must have height and width to plot correctly
        $("#burndown").css({ height: '700px', width : '900px' }).show();
        TASKBOARD.burndown.render($('#burndown'), data);
        $("#burndown").css({
                backgroundColor: 'white',
                border: '1px solid #CCCCCC',
                borderRadius: '25px',
                zIndex: 1001
            });

        $("#taskboard").overlay({
                target: "#burndown",
                mask: { color: 'white', loadSpeed: 200, opacity: 0.7, zIndex: 999 },
                closeOnEsc: false,
                load: true,
                clickMode: false // JUG: added fix in overlay-lib disabling adding click-event
            });

        /* [10-Oct-2010/JUG] replaced openOverlay() by using jquery-tools-overlay lib
        // div must have height and width to plot
        $("#burndown").css({ height: '700px', width : '900px' });
        $("#burndown").show();

        TASKBOARD.burndown.render($('#burndown'), data);
        $("#burndown").openOverlay({
            height: '700px',
            width : '900px',
            position: 'fixed',
            top: '50%',
            left: '50%',
            marginTop: '-350px',
            marginLeft:'-450px',
            backgroundColor: 'white',
            border: '1px solid #CCCCCC',
            borderRadius: '20px',
            zIndex: 1001
        });
        */
    });

    /* original burndown-showing
    ev.preventDefault();
    var self = TASKBOARD;
    TASKBOARD.remote.get.taskboardBurndown(self.id, function(data){

        if(!$('#burndown').exists()){
            $('body').append('<div id="burndown"></div>');
        }

        // div must have height and width to plot
        $("#burndown").css({ height: '400px', width : '600px' });
        $("#burndown").show();

        TASKBOARD.burndown.render($('#burndown'), data);
        $("#burndown").openOverlay({
            height: '400px',
            width : '600px',
            position: 'fixed',
            top: '50%',
            left: '50%',
            marginTop: '-200px',
            marginLeft:'-300px',
            backgroundColor: 'white',
            border: '1px solid #CCCCCC',
            borderRadius: '20px',
            zIndex: 1001
        });
    });
    */
};


TASKBOARD.initBurndown = function(ev){
    ev.preventDefault();
    var self = TASKBOARD;
    $(this).parent().siblings().removeClass("current").end().toggleClass("current");

    TASKBOARD.remote.get.taskboardInitBurndown(self.id, function(data){
        TASKBOARD.form.updateInitBurndown(data.initburndown);
        TASKBOARD.form.toggle('#fieldsetInitBurndown');
    });
};

TASKBOARD.fixBurndown = function(ev){
    ev.preventDefault();
    var self = TASKBOARD;
    $(this).parent().siblings().removeClass("current").end().toggleClass("current");

    TASKBOARD.remote.get.taskboardFixBurndown(self.id, function(data){
        TASKBOARD.form.updateFixBurndown(data);
        TASKBOARD.form.toggle('#fieldsetFixBurndown');
    });
};

TASKBOARD.openCard = function(bindObj, card){
    $('.bigCard').remove();
    var bigCard = TASKBOARD.builder.buildBigCard(card);
    bigCard.appendTo($('body')).hide();
    $(bindObj).overlay({
            target: "#bigCard",
            mask: { color: 'white', loadSpeed: 200, opacity: 0.7, zIndex: 999 },
            closeOnEsc: false,
            load: true,
            clickMode: false, // JUG: added fix in overlay-lib disabling adding click-event
            fixed: false, // move card with background for big-cards with much text that needs scrolling

            onBeforeClose: function(ev) {
                if($(this.getOverlay()).find(".editable form").length) {
                    ev.preventDefault();
                    alert("You have unsaved changes. Save or cancel them before closing!");
                    return;
                }
                $(this).closeTooltip();
            }
        });

    /* NOTE: no burndown on card
    TASKBOARD.remote.get.cardBurndown(card.id, function(data){
        var burndown = $("<dd id='cardBurndown'></dd>");
        burndown.css({ width: '550px', height: '300px' });
        bigCard.append(burndown);
        TASKBOARD.burndown.render(burndown, data);
    });
    */
};

TASKBOARD.openColorPicker = function(card, top, left){
    $.colorPicker({
        click : function(color){
            $(card).css({ backgroundColor : color});
            $(card).data('data').color = color;
            TASKBOARD.remote.api.changeCardColor($(card).data('data').id, color);
        },
        colors : ['#F8E065', '#FAA919', '#C48444', '#12C2D9', '#FF5A00', '#35B44B', '#CCCCCC', '#D070D0'],
        columns: 4,
        top : top,
        left : left,
        defaultColor : $(card).data('data').color
    });
}

TASKBOARD.openRowActions = function(row, top, left){
    var elemId = "rowActionsDialog";

    // hide existing dialog
    if($('#' + elemId).exists()){
        var isSameRow = ( $('#' + elemId).data("data").id === row.id );
        $('#' + elemId).fadeOut("fast", function(){ $(this).remove() });
        if(isSameRow)
            return;
    }

    var dialog = $('<div id="' + elemId + '">'
        + '<ul>'
        + '<li><form id="rowActionsMoveRowForm" action="#">'
            + 'Move row to position: <input id="pos" type="text" name="pos" size="2"> <input type="submit" value="Move">'
        + '</form></li>'
        + '<li><form id="rowActionsCopyRowForm" action="#">'
            + 'Copy cards from row ID: <input id="id" type="text" name="id" size="5"> <input type="submit" value="Copy">'
        + '</form></li>'
        + '</ul></div>');

    dialog.data("data", row);

    dialog.find("#rowActionsMoveRowForm").bind("submit", function(){
        var posValue = $('#rowActionsMoveRowForm #pos').val().trim();
        if(posValue.length == 0 || !posValue.match(/^[0-9]+$/) || row.position == posValue){
            $('#rowActionsMoveRowForm #pos').effect("highlight", { color: "darkred" }).focus();
            return false;
        }

        TASKBOARD.remote.api.moveRow(row.id, posValue);
        $('#' + elemId).fadeOut("fast", function(){ $(this).remove() });
        return false;
    });

    dialog.find("#rowActionsCopyRowForm").bind("submit", function(){
        var srcRowId = $('#rowActionsCopyRowForm #id').val().trim();
        if(srcRowId.length == 0 || !srcRowId.match(/^[0-9]+$/)){
            $('#rowActionsCopyRowForm #id').effect("highlight", { color: "darkred" }).focus();
            return false;
        }

        TASKBOARD.remote.api.copyRow(srcRowId, row.id);
        $('#' + elemId).fadeOut("fast", function(){ $(this).remove() });
        return false;
    });

    dialog.appendTo($('body'));
    $('#' + elemId).css( { top : top, left : left, bottom : "auto", right : "auto" });
    $('#' + elemId +' #pos').focus();
};

$(document).ready(function() {
    var self = TASKBOARD;
    self.init();
    TASKBOARD.remote.get.taskboardData(self.id, self.loadFromJSON);

    // highlight resizing columns
    $(".ui-resizable-handle")
        .live("mouseover", function(){ $(this).parent().addClass("resizing"); })
        .live("mouseout", function(){ $(this).parent().removeClass("resizing"); });

    // open external links in new window
    $('a[rel="external"]').live('click',function(ev) {
        window.open( $(this).attr('href') );
        ev.preventDefault();
    });
});

TASKBOARD.refresh = function(message) {
    message = message || "Taskboard refreshed.";
    var callback = function(data){
        TASKBOARD.loadFromJSON(data);
        if (message) $.notify(message);
    }
    TASKBOARD.remote.get.taskboardData(TASKBOARD.id, callback);
}

TASKBOARD.tags = {
    tagList : {},

    add : function(tag){
        var tagObject = this.tagList[tag];
        if(tagObject) {
            tagObject.count++;
            return tagObject;
        } else {
            tagObject = { tag : tag, className : "tagged_as_" + tag.toClassName(), count : 1 };
            this.tagList[tag] = tagObject;
            return tagObject;
        }
    },

    showTagSearch : function(ev) {
        $(this).parent().siblings().removeClass("current").end().toggleClass("current");

        // maintain CCPM
        var countCards = 0;
        $.each(TASKBOARD.data.cards, function(i, card) {
            if( card.rd_id > 0 )
                countCards++;
        });
        $('#fieldsetTags #maintainCCPMCount').text(countCards);

        TASKBOARD.form.toggle('#fieldsetTags');
        ev.preventDefault();
    },

    toggleShowTag : function() {
        $(this).parent().toggleClass("current");
        TASKBOARD.tags.updateCardSelection();
        return false;
    },

    ccpm : {
        markRead : function() {
            TASKBOARD.remote.api.markCardsRemainingDaysAsRead();
            $(this).parent().siblings().removeClass("current").end().toggleClass("current");
            TASKBOARD.form.toggle('#fieldsetTags');
        }
    },

    rebuildTagList : function(){
        this.tagList = {};
        $("#taskboard .cards > li").each(function(){
            $.each($(this).data("data").tag_list, function(i, tag){
                TASKBOARD.tags.add(tag);
            });
        });
    },

    updateTagsList : function(){
        this.rebuildTagList();

        var tagsLinks = "";
        var className = $("#filterTags a[href='#notags']").parent().hasClass("current") ? "current" : "";
        tagsLinks += $.tag("li", $.tag("a", "No tags", { href : "#notags", title : "Highlight cards with no tags" }),
                             { className : className } );

        className = $("#filterTags a[href='#ccpm']").parent().hasClass("current") ? "current" : "";
        tagsLinks += $.tag("li", $.tag("a", "CCPM", { id: "ccpmTag", href : "#ccpm", title : "Highlight CCPM-cards" }),
                             { className : className } );

        $.each(this.tagList, function(){
            className = $("#filterTags a[href='#" + this.className + "']").parent().hasClass("current") ? "current" : "";
            tagsLinks += $.tag("li", $.tag("a", this.tag.escapeHTML(), { href : "#" + this.className, title: "Highlight cards tagged as '" + this.tag + "'" }),
                                 { className : className });
        });
        $("#filterTags").html(tagsLinks);
    },

    updateCardSelection : function(){
        var cardSelectors = [];

        $("#filterTags .current a").each(function(){

            var cardSelector = "";
            if($(this).attr('href') === '#notags'){
                cardSelector = ":not([class*='tagged_as_'])";
            } else if($(this).attr('href') === '#ccpm'){
                cardSelector = ":[class='tagged_as_CCPM']";
            } else {
                cardSelector = $(this).attr('href').replace("#", ".");
            }

            cardSelectors.push(cardSelector);
        });

        var filtered = $("#taskboard .cards > li").css("opacity", null);
        $.each(cardSelectors, function(){
            filtered = filtered.not("#taskboard .cards > li" + this);
        });
        if($("#filterTags .current a").length){
            filtered.css("opacity", 0.2);
        }
    }
};

// TODO: refactor and make more generic plugin
/* [10-Oct-2010/JUG] refactored using jquery-tools overlay lib
$.fn.openOverlay = function(css){
    var self = this;
    $('body').append('<div id="overlay"></div>');
    $("#overlay").css({
        height: '100%',
        width : '100%',
        position: 'fixed',
        top: '0',
        left: '0',
        backgroundColor: 'white',
        opacity: 0.8,
        zIndex: 1000
    }).click(function(){
        if($(self).find(".editable form").length) {
            alert("You have unsaved changes. Save or cancel them before closing");
            return;
        }
        $('#overlay').remove();
        $(self).hide();
        $('#taskboard').css({ position : ''});
    });
    $(this).css(css);
    $(this).show();
    $('#taskboard').css({ position : 'fixed'});
};
*/

TASKBOARD.remote = {
    /*
     * Utilities for managing loading taskboard image
     * =========================================================
     */
    loading : {
        start : function(){
            if(!$('#loading').exists()){
                $('<div id="loading"></div>').appendTo($('body'));
            }
        },
        stop : function(){
            $('#loading').fadeOut(function(){ $(this).remove(); });
        }
    },

    // TODO: is this needed?
    checkStatus : function(json){
        TASKBOARD.remote.loading.stop();
        return json.status;
    },

    callback : function(url, params, successCallback){
            if(typeof successCallback === 'string'){
                TASKBOARD.remote.loading.start();
            }
            $.getJSON(url, params,
                    function(json){
                        if(typeof successCallback === 'function'){
                            successCallback();
                        } else {
                            if(TASKBOARD.remote.checkStatus(json) === 'success'){
                                if((typeof successCallback === 'string') && !juggernaut.is_connected){
                                    sync[successCallback](json, true);
                                }
                            } else {
                                $.notify(json.message, { cssClass : "error" });
                            }
                        }
                    });
    },

    get: {
        taskboardData: function(id, callback){
            $.getJSON("/taskboard/get_taskboard/" + id, function(data){
                callback(data);
                TASKBOARD.remote.loading.stop();
            });
        },
        taskboardBurndown: function(id, callback){
            TASKBOARD.remote.loading.start();
            $.getJSON('/taskboard/load_burndown/' + id, function(data){
                callback(data);
                TASKBOARD.remote.loading.stop();
            });
        },
        cardBurndown: function(id, callback){
            $.getJSON('/card/load_burndown/' + id, callback);
        },
        taskboardInitBurndown: function(id, callback){
            $.getJSON("/taskboard/get_initburndown/" + id, function(data){
                callback(data);
                TASKBOARD.remote.loading.stop();
            });
        },
        taskboardFixBurndown: function(id, callback){
            $.getJSON("/taskboard/get_fixburndown/" + id, function(data){
                callback(data);
                TASKBOARD.remote.loading.stop();
            });
        },
        taskboardBurndown2: function(id, callback){
            TASKBOARD.remote.loading.start();
            $.getJSON('/taskboard/load_burndown2/' + id, function(data){
                callback(data);
                TASKBOARD.remote.loading.stop();
            });
        }
    },

    //TODO: change to POST requests
    api: {
        addCards : function(name, column_id){
            TASKBOARD.remote.callback("/taskboard/add_card",
                            { name : name, taskboard_id : TASKBOARD.id, column_id : column_id },
                            'addCards');
        },
        addColumn : function(name){
            TASKBOARD.remote.callback("/taskboard/add_column",
                            { name : name, taskboard_id : TASKBOARD.id },
                            'addColumn');
        },
        addRow : function(){
            TASKBOARD.remote.callback("/taskboard/add_row",
                            { taskboard_id : TASKBOARD.id },
                            'addRow');
        },
        moveCard : function(cardId, columnId, rowId, position){
            TASKBOARD.remote.callback("/taskboard/reorder_cards",
                            { position : position, column_id : columnId, id : cardId, row_id: rowId });
        },
        copyCard : function(cardId, copyCard){
            TASKBOARD.remote.callback('/taskboard/copy_card',
                            { id: cardId, copy: (copyCard ? 1 : 0) },
                            'copyCard');
        },
        moveColumn : function(columnId, position){
            TASKBOARD.remote.callback("/taskboard/reorder_columns",
                            { position : position, id : columnId });
        },
        renameTaskboard : function(name){
            TASKBOARD.remote.callback('/taskboard/rename_taskboard', { id : TASKBOARD.id, name : name });
        },
        renameColumn : function(columnId, name){
            TASKBOARD.remote.callback('/taskboard/rename_column', { id : columnId, name : name });
        },
        renameCard : function(cardId, name){
            TASKBOARD.remote.callback('/card/update_name', { id : cardId, name : name });
        },
        updateCardNotes : function(cardId, notes){
            TASKBOARD.remote.callback('/card/update_notes', { id : cardId, notes : notes });
        },
        addTags : function(cardId, tags){
            TASKBOARD.remote.callback('/card/add_tag', { id : cardId, tags : tags });
        },
        removeTag : function(cardId, tag){
            TASKBOARD.remote.callback('/card/remove_tag', { id : cardId, tag : tag });
        },
        deleteColumn : function(columnId){
            TASKBOARD.remote.callback('/taskboard/remove_column/', { id: columnId });
        },
        cleanColumn : function(columnId){
            TASKBOARD.remote.callback('/taskboard/clean_column/', { id: columnId });
        },
        deleteRow : function(rowId){
            TASKBOARD.remote.callback('/taskboard/remove_row/', { id: rowId });
        },
        cleanRow : function(rowId){
            TASKBOARD.remote.callback('/taskboard/clean_row/', { id: rowId });
        },
        moveRow : function(rowId, newPos){
            TASKBOARD.remote.callback('/taskboard/reorder_rows', { id: rowId, position: newPos });
        },
        copyRow : function(srcRowId, trgRowId){
            TASKBOARD.remote.callback('/taskboard/copy_row', { src_id: srcRowId, trg_id: trgRowId });
        },
        updateCardHours : function(cardId, hours, updatedAt, callback){
            TASKBOARD.remote.callback('/card/update_hours/', { id: cardId, hours_left: hours, updated_at: updatedAt }, callback);
        },
        deleteCard : function(cardId){
            TASKBOARD.remote.callback('/taskboard/remove_card/', { id: cardId });
        },
        changeCardColor : function(cardId, color){
            TASKBOARD.remote.callback('/card/change_color/', { id: cardId, color : color });
        },
        updateInitBurndown : function(dates_str, cols_arr, duetime, capacity, slack, commit_po, commit_team, velocity){ // remote
            TASKBOARD.remote.callback("/taskboard/update_initburndown",
                    { taskboard_id : TASKBOARD.id, dates : dates_str, cols_arr : cols_arr, duetime : duetime,
                      capacity : capacity, slack : slack, commitment_po : commit_po, commitment_team : commit_team, velocity : velocity });
        },
        updateFixBurndown : function(date_str, hour_str){ // remote
            TASKBOARD.remote.callback("/taskboard/update_fixburndown",
                    { taskboard_id : TASKBOARD.id, date_str : date_str, hours : hour_str });
        },
        foldRow : function(rowId, curr_fold){
            TASKBOARD.remote.callback('/taskboard/fold_row', { id: rowId, fold: (curr_fold ? 0 : 1) }, 'foldRow');
        },
        updateCardRemainingDaysId : function(cardId, id){
            TASKBOARD.remote.callback('/card/update_rd_id/', { id: cardId, new_id: id });
        },
        updateCardRemainingDaysDays : function(cardId, days, needRead){
            TASKBOARD.remote.callback('/card/update_rd_days/', { id: cardId, days_left: days, need_read: (needRead ? 1 : 0) });
        },
        updateCardClearRemainingDays : function(cardId){
            TASKBOARD.remote.callback('/card/clear_rd/', { id: cardId });
        },
        markCardsRemainingDaysAsRead : function(){
            TASKBOARD.remote.callback('/card/mark_read_rd_all', { id : TASKBOARD.id });
        },
    }
};


/*
 * Implementation of synchronisation API.
 * These methods are launched by synchronisation service (via juggernaut).
 */
window.sync = {
    call : function(action, json, self){
        if(typeof(self) === 'undefined'){ self = false; }
        var callback = !self ? TASKBOARD.remote.checkStatus(json) === 'success' : true;
        if(callback){
            $.notify(json.message);
            TASKBOARD.api[action](json.object);
        }
    }
};

$.each(['renameTaskboard',
        'addColumn', 'renameColumn', 'moveColumn', 'deleteColumn', 'cleanColumn',
        'addRow', 'deleteRow', 'cleanRow', 'moveRow', 'copyRow',
        'addCards','copyCard','moveCard','updateCardHours','changeCardColor',
            'deleteCard', 'renameCard', 'updateCard', 'updateCards',
        'updateInitBurndown','updateFixBurndown', 'foldRow'],
        function(){
            var action = this;
            sync[action] = function(data, self){
                sync.call(action, data, self);
            };
        });

/* TODO refactor notifications */
$(document).ready(function() {
    $('body').append('<ol id="notifications"></ol>');
});

$.notify = function(msg, options){
    var settings = { cssClass : "", timeout : 5000 };
    $.extend(settings, options);

    var notification = $("<li></li>");
    if(settings.cssClass){
        notification.addClass(settings.cssClass);
    }
    notification.text(msg);
    notification.click(function(){ $(this).fadeOut(); });
    $("#notifications").prepend(notification);
    if(settings.timeout > 0){
        setTimeout(function(){ notification.fadeOut(); }, settings.timeout);
    }
};

/* TODO: clean up */
$.each(["connect", "connected", "errorConnecting", "disconnected", "reconnect", "noFlash"], function(){
    var self = this;
    var msgs = {
        "initialized" : "Synchronization service initialized.",
        "connect"     : "Trying to connect to synchronization service.",
        "connected"   : "Successfully connected to synchronization service.",
        "errorConnecting" : "Cannot connect to synchronization service.",
        "disconnected" : "Connection with synchronization service was lost.",
        "reconnect" : "Trying to reconnect with synchronisation service.",
        "noFlash" : "Flash plugin was not detected! Real time synchronisation will not work."
    };
    $(document).bind("juggernaut:" + self, function(){
        $.notify(msgs[self]);
    });
});

$(document).bind("juggernaut:connected", function(){
    TASKBOARD.refresh();
});


TASKBOARD.cookie = {
    // all cookies are valid for 30 days
    options : { expires: 30 },

    getColumnWidth : function(columnId){
        return $.cookie('column_width_' + columnId);
    },

    setColumnWidth : function(columnId, width){
        return $.cookie('column_width_' + columnId, width, this.options);
    },

    getTaskboardZoom : function(taskboardId){
        return $.cookie('taskboard_zoom_' + taskboardId);
    },

    setTaskboardZoom : function(taskboardId, zoom){
        return $.cookie('taskboard_zoom_' + taskboardId, zoom, this.options);
    }
};

// formatting
TASKBOARD.Format = {
    monthNames : [ "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec" ],

    buildDate : function(sdate) { // sdate (string) = YYYY-MM-DDTHH:MM:SSZ -> returns Date() with date+time
        if( (sdate !== null) && !(sdate instanceof Date) && typeof(sdate) == 'string' )
            sdate = new Date(parseInt(sdate.substr(0,4)), parseInt(sdate.substr(5,2)) - 1, parseInt(sdate.substr(8,2)),
                             parseInt(sdate.substr(11,2)), parseInt(sdate.substr(14,2)) - 1, parseInt(sdate.substr(17,2)) );
        return sdate;
    },

    formatDate : function(dateArg) {
        var fdate = TASKBOARD.Format.buildDate(dateArg);

        if( (fdate !== null) && (fdate instanceof Date) )
            return ((fdate.getDate() <= 9) ? "0" : "") + fdate.getDate() + "-"
                + TASKBOARD.Format.monthNames[fdate.getMonth()] + "-" + fdate.getFullYear() + " "
                + ((fdate.getHours() <= 9) ? "0" : "") + fdate.getHours() + ":"
                + ((fdate.getMinutes() <= 9) ? "0" : "") + fdate.getMinutes() + ":"
                + ((fdate.getSeconds() <= 9) ? "0" : "") + fdate.getSeconds();
        else
            return "---";
    },

    formatCCPMId : function(ccpmId, enableEdit){
        if( ccpmId > 0 )
            return "CCPM #" + ( enableEdit ? $.tag("span", ccpmId, { id: "edit_ccpm_id", className: "editable" }) : ccpmId );
        else
            return (enableEdit) ? "CCPM #" + $.tag("span", "ID", { id: "edit_ccpm_id", className: "editable" }) : "CCPM";
    },

    formatCCPM : function(card, isBigCard) {
        var needsUpdate = !card.rd_needread;
        var rd_updated = TASKBOARD.Format.buildDate(card.rd_updated);

        var suffix = (isBigCard) ? '' : '_' + card.id;
        var rdDays = $.tag("span", card.rd_days, { id: "edit_ccpm_days" + suffix, className: "editable ccpmDays" }) + " days"

        if( isBigCard ) { // big-card
            var rdDate = $.tag("span", TASKBOARD.Format.formatDate(rd_updated), { id: "ccpmUpdated" });
            var rdRead = $.tag("span", (needsUpdate ? "UPDATE" : "READING"), { id: "ccpmUpdated2" });
            return rdDays + ", updated at [" + rdDate + "] >>> needs " + rdRead;
        } else { // small-card
            var rdClass = (needsUpdate) ? 'ccpmNeedsUpdate' : 'ccpmDone';
            return TASKBOARD.Format.formatCCPMId(card.rd_id, false) + ': '
                + $.tag("span", rdDays, { id: "ccpmDaysInfo", className: rdClass });
        }
    }
};

// utility to dump DOM-object
TASKBOARD.dumpProps = function( obj, parent ) {
    // Go through all the properties of the passed-in object
    var msg = '';
    for (var i in obj) {
        // if a parent (2nd parameter) was passed in, then use that to build the message.
        // Message includes i (the object's property name) then the object's property value on a new line
        msg += (parent) ? parent + "." + i + "\n" + obj[i] : i + "\n" + obj[i];
        msg += "\n";

        // If this property (i) is an object, then recursively process the object
        if (typeof(obj[i]) == "object") {
            if (parent) {
                TASKBOARD.dumpProps(obj[i], parent + "." + i);
            } else {
                TASKBOARD.dumpProps(obj[i], i);
            }
        }
    }

    alert(msg);
};

TASKBOARD.formatVelocity = function( velocity ){ // velocity = %-value * 100
    return (Math.round(velocity) / 100) + "%";
};

})(jQuery); // just to make sure $ was a jQuery

