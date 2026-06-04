PREFIX ?= /usr/local
BINDIR ?= $(PREFIX)/bin
LIBDIR ?= $(PREFIX)/lib/pub-sub-tmux
CONFDIR ?= $(PREFIX)/etc/pub-sub-tmux

.PHONY: install uninstall test test-patterns test-integration

install:
	@bash install.sh $(PREFIX)

uninstall:
	@rm -f $(BINDIR)/pst-publish $(BINDIR)/pst-subscribe $(BINDIR)/pst-send
	@rm -rf $(LIBDIR)
	@rm -rf $(CONFDIR)
	@echo "pub-sub-tmux removed from $(BINDIR)"

test: test-patterns test-integration

test-patterns:
	@bash tests/test-patterns.sh

test-integration:
	@bash tests/test-publish-subscribe.sh
