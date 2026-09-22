(function () {
  'use strict';
  var doc = document;
  doc.documentElement.className += ' dlb-js';

  function each(list, fn) { Array.prototype.forEach.call(list, fn); }

  function formatNumber(value, sep, decimals) {
    var fixed = value.toFixed(decimals);
    if (!sep) return fixed;
    var parts = fixed.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }

  function runCounter(el) {
    var from = parseFloat(el.getAttribute('data-from')) || 0;
    var to = parseFloat(el.getAttribute('data-to')) || 0;
    var duration = parseInt(el.getAttribute('data-duration'), 10) || 2000;
    var sep = el.getAttribute('data-sep') === '1';
    var decimals = (String(to).split('.')[1] || '').length;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = formatNumber(to, sep, decimals);
      return;
    }
    var start = null;
    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min(1, (ts - start) / duration);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = formatNumber(from + (to - from) * eased, sep, decimals);
      if (p < 1) window.requestAnimationFrame(step);
    }
    window.requestAnimationFrame(step);
  }

  function observe(elements, onVisible) {
    if (!('IntersectionObserver' in window)) { each(elements, onVisible); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { io.unobserve(entry.target); onVisible(entry.target); }
      });
    }, { threshold: 0.15 });
    each(elements, function (el) { io.observe(el); });
  }

  function servedByCms() {
    return /^\/(sites|preview)\//.test(window.location.pathname);
  }

  function postJson(url, payload) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (res) {
        var type = res.headers.get('content-type') || '';
        if (type.indexOf('application/json') === -1) throw new Error('not-json');
        return res.json().then(function (data) {
          if (!res.ok || data.success === false) throw new Error(data.error || 'Submission failed');
          return data;
        });
      });
  }

  function bindForm(form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var status = form.querySelector('.dlb-form-status');
      var button = form.querySelector('button[type="submit"]');
      var label = button ? button.textContent : '';
      var data = {};
      each(form.elements, function (field) {
        if (!field.name || field.disabled) return;
        if (field.type === 'checkbox') { data[field.name] = field.checked ? 'Yes' : 'No'; return; }
        data[field.name] = field.value;
      });
      if (form.checkValidity && !form.checkValidity()) {
        if (form.reportValidity) form.reportValidity();
        return;
      }
      var known = { name: 1, email: 1, phone: 1, company: 1, subject: 1, message: 1, _gotcha: 1 };
      var extra = [];
      Object.keys(data).forEach(function (k) { if (!known[k]) extra.push(k.replace(/_/g, ' ') + ': ' + data[k]); });
      var formName = form.getAttribute('data-form-name') || 'Website enquiry';
      var payload = {
        siteId: form.getAttribute('data-site-id') || undefined,
        type: 'contact',
        name: data.name || data.full_name || '',
        email: data.email || '',
        phone: data.phone || '',
        company: data.company || '',
        topicOrProduct: data.subject || formName,
        details: [data.message || ''].concat(extra).filter(Boolean).join('\n'),
        metadata: { formName: formName, page: window.location.pathname, fields: data },
        hp: data._gotcha || ''
      };
      if (button) { button.disabled = true; button.textContent = 'Sending…'; }
      if (status) { status.textContent = ''; status.removeAttribute('data-state'); }

      var attempt = servedByCms()
        ? postJson('/api/inquiries', payload)
        : postJson('contact.php', Object.assign({}, data, { subject: payload.topicOrProduct, message: payload.details }))
            .catch(function () { return postJson('/api/inquiries', payload); });

      attempt.then(function () {
        if (status) { status.textContent = form.getAttribute('data-success') || 'Thank you!'; status.setAttribute('data-state', 'ok'); }
        form.reset();
      }).catch(function (err) {
        if (status) {
          status.textContent = (err && err.message && err.message !== 'not-json') ? err.message : 'Sorry, your message could not be sent. Please call or email us instead.';
          status.setAttribute('data-state', 'error');
        }
      }).then(function () {
        if (button) { button.disabled = false; button.textContent = label; }
      });
    });
  }

  function init(root) {
    root = root || doc;
    observe(root.querySelectorAll('.dlb-anim:not([data-dlb-bound])'), function (el) { el.className += ' dlb-in'; });
    each(root.querySelectorAll('.dlb-anim'), function (el) { el.setAttribute('data-dlb-bound', '1'); });

    var counters = root.querySelectorAll('.dlb-count:not([data-dlb-bound])');
    each(counters, function (el) { el.setAttribute('data-dlb-bound', '1'); });
    observe(counters, runCounter);

    each(root.querySelectorAll('form[data-dlb-form]:not([data-dlb-bound])'), function (form) {
      form.setAttribute('data-dlb-bound', '1');
      bindForm(form);
    });

    each(root.querySelectorAll('[data-dlb-dismiss]:not([data-dlb-bound])'), function (btn) {
      btn.setAttribute('data-dlb-bound', '1');
      btn.addEventListener('click', function () {
        var box = btn.closest('.dlb-widget');
        if (box) box.style.display = 'none';
      });
    });

    each(root.querySelectorAll('.dlb-nav-link:not([data-dlb-bound])'), function (link) {
      link.setAttribute('data-dlb-bound', '1');
      link.addEventListener('click', function () {
        var nav = link.closest('.dlb-nav');
        var check = nav && nav.querySelector('.dlb-nav-check');
        if (check) check.checked = false;
      });
    });

    each(root.querySelectorAll('details.dlb-acc-item[name]:not([data-dlb-bound])'), function (item) {
      item.setAttribute('data-dlb-bound', '1');
      item.addEventListener('toggle', function () {
        if (!item.open) return;
        var name = item.getAttribute('name');
        each(doc.querySelectorAll('details.dlb-acc-item[name="' + name + '"]'), function (other) {
          if (other !== item) other.open = false;
        });
      });
    });
  }

  window.dlbInit = init;
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', function () { init(doc); });
  else init(doc);
})();
