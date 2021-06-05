{
  "targets": [
    {
      "target_name": "module",
      "product_extension": "node",
      "include_dirs" : [ "lib/wasm" ],
      "conditions": [
        ['OS=="win"', {
          'cflags': [
            '/EHa',
          ],
        },],
      ],
      "sources": [
        "lib/wasm/module.cc"
      ]
    }
  ]
}