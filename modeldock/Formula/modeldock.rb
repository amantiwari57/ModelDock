class Modeldock < Formula
  include Language::Python::Virtualenv

  desc "Zero-SSD local LLM runner for macOS via Cloudflare R2 and RAM-disks"
  homepage "https://github.com/modeldock/modeldock"
  url "https://github.com/modeldock/modeldock/archive/refs/tags/v0.1.0.tar.gz"
  sha256 "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  license "MIT"

  depends_on "python@3.11"
  depends_on "llama.cpp"

  def install
    virtualenv_install_with_resources
  end

  test do
    system "#{bin}/modeldock", "--help"
  end
end
