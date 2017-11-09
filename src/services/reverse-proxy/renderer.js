class ReverseProxyRenderer {
  render(data) {
    console.log(data.proxies); //XXX
    const ret = [];
    ret.push(`
upstream {

}
    `)
  }
}

module.exports = ReverseProxyRenderer;
