package main

import (
	"errors"
	"testing"
)

func TestWindowsCloseDialogResult(t *testing.T) {
	for _, c := range []struct {
		answer  string
		err     error
		prevent bool
	}{{"Yes", nil, false}, {"yes", nil, false}, {"No", nil, true}, {"Cancel", nil, true}, {"Error", nil, false}, {"", nil, false}, {"", errors.New("dialog unavailable"), false}} {
		if got := preventClose(c.answer, c.err); got != c.prevent {
			t.Errorf("preventClose(%q,%v)=%v want %v", c.answer, c.err, got, c.prevent)
		}
	}
}
