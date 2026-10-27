jQuery(document).ready(function ($) {
  $('#track-form').on('submit', function (e) {
    e.preventDefault();

    const awb = $('#awb').val().trim();
    const reference = $('#reference').val().trim();

    let trackType = '';
    let trackNumber = '';

    if (awb.length > 0) {
      trackType = 'cnno';
      trackNumber = awb;
    } else if (reference.length > 0) {
      trackType = 'refno';
      trackNumber = reference;
    } else {
      $('#tracking-result').html("Please enter AWB or Reference Number.");
      return;
    }

    console.log("Sending trackType:", trackType, "trackNumber:", trackNumber);

    // $('#tracking-result').html('Tracking shipment...');

    $.ajax({
      url: track_ajax_obj.ajax_url,
      type: 'POST',
      data: {
        action: 'dtdc_track_shipment',
        trackType: trackType,
        trackNumber: trackNumber
      },
      success: function (res) {
        $('#tracking-result').html(res);
      },
      error: function () {
        $('#tracking-result').html('Error contacting tracking API.');
      }
    });
  });
});
