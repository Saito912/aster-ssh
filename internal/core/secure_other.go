//go:build !windows

package core

import "errors"

func seal(data []byte) (string, error) {
	return "", errors.New("此版本只支持 Windows DPAPI 凭据保护")
}
func unseal(value string) ([]byte, error) {
	return nil, errors.New("Windows 凭据不能在其他系统解密")
}
