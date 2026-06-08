PREFIX ?= /usr/local
BINDIR ?= $(PREFIX)/bin
CONFDIR ?= $(PREFIX)/etc/pluk

.PHONY: build install uninstall clean

build:
	go build -o pluk ./cmd/pluk/

install: build
	@mkdir -p $(BINDIR) $(CONFDIR)/patterns.d
	@cp pluk $(BINDIR)/pluk
	@chmod +x $(BINDIR)/pluk
	@ln -sf pluk $(BINDIR)/pluk-publish
	@ln -sf pluk $(BINDIR)/pluk-subscribe
	@ln -sf pluk $(BINDIR)/pluk-send
	@cp -r config/patterns.d/* $(CONFDIR)/patterns.d/ 2>/dev/null || true
	@mkdir -p /var/run/pluk/logs /var/run/pluk/commands
	@chmod 1777 /var/run/pluk/logs /var/run/pluk/commands 2>/dev/null || true
	@echo "pluk installed to $(BINDIR)/pluk"

uninstall:
	@rm -f $(BINDIR)/pluk $(BINDIR)/pluk-publish $(BINDIR)/pluk-subscribe $(BINDIR)/pluk-send
	@rm -rf $(CONFDIR)
	@echo "pluk removed from $(BINDIR)"

clean:
	@rm -f pluk
