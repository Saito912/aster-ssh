// Developer-only loopback SSH fixture. This binary is not distributed.
package main

import (
	"asterssh/internal/testserver"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"golang.org/x/crypto/ssh"
	"os"
	"os/signal"
)

func main() {
	output := flag.String("info", "", "write test connection details as JSON")
	profile := flag.String("profile", "", "create a fresh isolated UI test profile and sample transfer tree")
	flag.Parse()
	b := make([]byte, 16)
	rand.Read(b)
	password := hex.EncodeToString(b)
	server, err := testserver.Start("127.0.0.1:0", password, nil)
	if err != nil {
		panic(err)
	}
	defer server.Close()
	if *profile != "" {
		if err := seedProfile(*profile, password, server); err != nil {
			panic(err)
		}
	}
	info := map[string]any{"address": server.Listener.Addr().String(), "user": "demo", "password": password, "fingerprint": ssh.FingerprintSHA256(server.Signer.PublicKey())}
	if *output != "" {
		data, _ := json.MarshalIndent(info, "", "  ")
		if err := os.WriteFile(*output, data, 0600); err != nil {
			panic(err)
		}
	}
	fmt.Println("Loopback SSH fixture listening at", server.Listener.Addr())
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt)
	<-stop
}
